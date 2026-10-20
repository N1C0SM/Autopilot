import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.25.76'
import { sendFeatureEmail } from './transactional-email-templates/send-email.ts'

const Body = z.object({
  recipientEmail: z.string().email().max(255),
  idempotencyKey: z.string().min(1).max(500),
  templateData: z.record(z.unknown()).default({}),
}).refine(value => JSON.stringify(value.templateData).length <= 50000, 'Email data too large')

// Fixed feature-owned template; caller input cannot select a template.
export function emailFeatureHandler(templateName: 'scan-diagnosis' | 'payment-reminder', adminOnly: boolean) {
  return async (req: Request) => {
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    try {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
      if (!token) return reply({ error: 'Unauthorized' }, 401)
      const { data: auth, error: authError } = await db.auth.getUser(token)
      if (authError || !auth.user) return reply({ error: 'Unauthorized' }, 401)
      const { data: admin, error: roleError } = await db.rpc('has_role', { _user_id: auth.user.id, _role: 'admin' })
      if (roleError) return reply({ error: 'Permission check failed' }, 500)
      const parsed = Body.safeParse(await req.json())
      if (!parsed.success) return reply({ error: 'Invalid email data' }, 400)
      const body = parsed.data
      if (adminOnly && admin !== true) return reply({ error: 'Forbidden' }, 403)
      if (admin !== true) {
        const { data: profile, error } = await db.from('profiles').select('email').eq('user_id', auth.user.id).maybeSingle()
        if (error) return reply({ error: 'Permission check failed' }, 500)
        if (!profile?.email || profile.email.toLowerCase() !== body.recipientEmail.toLowerCase()) return reply({ error: 'Forbidden' }, 403)
        body.recipientEmail = profile.email
      }
      const { data, error } = await sendFeatureEmail({ ...body, templateName })
      if (error) return reply({ error: error.message }, 500)
      return reply({ success: data?.sent === true, ...data })
    } catch {
      return reply({ error: 'Unable to send email' }, 500)
    }
  }
}
