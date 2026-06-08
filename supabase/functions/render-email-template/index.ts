import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const auth = req.headers.get('Authorization') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => ({}))
    const templateName = String(body.templateName || '')
    const templateData = (body.templateData && typeof body.templateData === 'object') ? body.templateData : {}
    const customHtml = typeof body.customHtml === 'string' ? body.customHtml : null

    const tpl = TEMPLATES[templateName]
    if (!tpl) return new Response(JSON.stringify({ error: 'template_not_found', available: Object.keys(TEMPLATES) }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const data = { ...(tpl.previewData ?? {}), ...templateData }
    const interpolate = (str: string) =>
      str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
        const val = key.split('.').reduce((acc: any, k: string) => acc?.[k], data)
        return val == null ? '' : String(val)
      })

    let html: string
    if (customHtml) {
      html = interpolate(customHtml)
    } else {
      // Match send-transactional-email behavior: prefer the admin override
      // (email_template_overrides) when enabled so the preview is literally
      // what gets sent. Fall back to rendering the React component.
      const { data: override } = await supabase
        .from('email_template_overrides')
        .select('subject, html, enabled')
        .eq('template_name', templateName)
        .maybeSingle()
      if (override && override.enabled && override.html) {
        html = interpolate(override.html)
      } else {
        html = await renderAsync(React.createElement(tpl.component, data))
      }
    }
    // Subject: also prefer override when available
    let subject: string
    {
      const { data: ov } = await supabase
        .from('email_template_overrides')
        .select('subject, enabled')
        .eq('template_name', templateName)
        .maybeSingle()
      if (ov && ov.enabled && ov.subject && !customHtml) {
        subject = interpolate(ov.subject)
      } else {
        subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject
      }
    }

    return new Response(JSON.stringify({ html, subject, previewData: tpl.previewData ?? {}, displayName: tpl.displayName ?? templateName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})