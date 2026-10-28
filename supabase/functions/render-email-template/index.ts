import { errorMessage } from "../_shared/runtime-values.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { renderTemplate } from '../_shared/transactional-email-templates/render.ts'

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

    // Fetch persisted override once (shared by both html and subject paths)
    const { data: override } = await supabase
      .from('email_template_overrides')
      .select('subject, html, enabled')
      .eq('template_name', templateName)
      .maybeSingle()

    const { html, subject } = await renderTemplate({
      templateName,
      templateData,
      override,
      customHtml,
      mergePreviewData: true,
    })

    return new Response(JSON.stringify({ html, subject, previewData: tpl.previewData ?? {}, displayName: tpl.displayName ?? templateName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: errorMessage(e) || 'error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})