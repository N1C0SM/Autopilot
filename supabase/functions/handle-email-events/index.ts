import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.3.1'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { EMAIL_OUTCOMES, eventLogId, type EmailReason } from '../_shared/email-event-reaction.ts'

const apiKey = Deno.env.get('LOVABLE_API_KEY')
if (!apiKey) throw new Error('Email API key missing')

async function recordOutcome(event: { event_id: string; data: { recipient: string; message_id?: string } }, reason: EmailReason) {
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const id = await eventLogId(event.event_id)
  const { data: existing, error: lookupError } = await db.from('email_send_log').select('id').eq('id', id).maybeSingle()
  const check = (error: { code: string; message: string } | null) => {
    if (!error) return
    console.error('Email event write failed', { code: error.code, message: error.message, event_id: event.event_id })
    throw new Error('Failed to record email event')
  }
  check(lookupError)
  if (existing) return
  const email = event.data.recipient.toLowerCase()
  const { error: suppressError } = await db.from('suppressed_emails').upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  check(suppressError)
  const outcome = EMAIL_OUTCOMES[reason]
  const { error: logError } = await db.from('email_send_log').upsert({
    id, message_id: event.data.message_id ?? null, template_name: 'system',
    recipient_email: email, status: outcome.status, error_message: outcome.message, metadata: null,
  }, { onConflict: 'id', ignoreDuplicates: true })
  check(logError)
}

const handler = createEmailWebhookHandler({
  apiKey,
  on: {
    'email.bounced': async event => recordOutcome(event, 'bounce'),
    'email.complaint': async event => recordOutcome(event, 'complaint'),
    'email.unsubscribed': async event => recordOutcome(event, 'unsubscribe'),
  },
})
Deno.serve(req => handler(req))
