import { createClient } from 'npm:@supabase/supabase-js@2'
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.3.1'
import { TEMPLATES } from './registry.ts'
import { renderTemplate } from './render.ts'

const SITE_NAME = 'Autopilot'
const SENDER_DOMAIN = 'notify.autopilotplan.com'
const FROM_DOMAIN = 'autopilotplan.com'

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }
export interface SendTemplateEmailOptions {
  templateData?: Record<string, unknown>
  idempotencyKey?: string
  replyTo?: string
}

// Retained legacy audit data is notification-only; never consult it to gate sends.
export async function sendTemplateEmail(
  templateName: string, to: string, options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured')
  const template = TEMPLATES[templateName]
  if (!template) throw new Error(`Template '${templateName}' not found`)
  const recipient = template.to || to
  if (!recipient) throw new Error('Recipient is required')
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const audit = async (status: 'sent' | 'suppressed' | 'failed', errorMessage?: string) => {
    const { error } = await db.from('email_send_log').insert({
      message_id: null, template_name: templateName, recipient_email: recipient,
      status, ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    if (error) console.error('Email audit write failed', { code: error.code, message: error.message })
  }
  try {
    const { data: override, error } = await db.from('email_template_overrides')
      .select('subject, html, enabled').eq('template_name', templateName).maybeSingle()
    if (error) throw new Error('Failed to read email template override')
    const rendered = await renderTemplate({ templateName, templateData: options.templateData,
      override, mergePreviewData: false })
    await sendLovableEmail({
      to: recipient, from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`, sender_domain: SENDER_DOMAIN,
      subject: rendered.subject, html: rendered.html, text: rendered.plainText,
      purpose: 'transactional', label: templateName,
      idempotency_key: options.idempotencyKey || crypto.randomUUID(), reply_to: options.replyTo,
    }, { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') })
    await audit('sent')
    return { sent: true }
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      await audit('suppressed')
      return { sent: false, reason: 'recipient_suppressed' }
    }
    await audit('failed', error instanceof Error ? error.message : 'Email send failed')
    throw error
  }
}

// Compatibility for existing feature callers: success now means sent, never queued.
// Existing recipient loops retain their behavior and honor in-request rate limits.
export async function sendFeatureEmail(body: {
  templateName: string; recipientEmail: string; idempotencyKey?: string;
  templateData?: Record<string, unknown>;
}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await sendTemplateEmail(body.templateName, body.recipientEmail, {
        templateData: body.templateData, idempotencyKey: body.idempotencyKey,
      })
      return { data, error: null }
    } catch (error) {
      if (error instanceof EmailAPIError && error.status === 429 && attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, (error.retryAfterSeconds ?? 60) * 1000))
        continue
      }
      return { data: null, error: error instanceof Error ? error : new Error('Email send failed') }
    }
  }
}
