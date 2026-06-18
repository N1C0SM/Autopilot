import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_BYTES = 4 * 1024 * 1024 // ~4MB

// naive in-memory rate limit per IP (per instance)
const hits = new Map<string, { count: number; reset: number }>()
const LIMIT = 20
const WINDOW_MS = 60_000

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = hits.get(ip)
  if (!bucket || bucket.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS })
    return false
  }
  bucket.count += 1
  return bucket.count > LIMIT
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:image\/png;base64,/, '').replace(/\s+/g, '')
  const bin = atob(clean)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function isPng(bytes: Uint8Array): boolean {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < sig.length) return false
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return false
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let pngBase64: string | undefined
  try {
    const body = await req.json()
    pngBase64 = body?.pngBase64
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!pngBase64 || typeof pngBase64 !== 'string') {
    return new Response(JSON.stringify({ error: 'pngBase64 required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(pngBase64)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid base64' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (bytes.length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'Image too large' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!isPng(bytes)) {
    return new Response(JSON.stringify({ error: 'Not a PNG' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const id = crypto.randomUUID()
  const path = `scan-cards/${id}.png`

  const { error: upErr } = await supabase.storage
    .from('site-assets')
    .upload(path, bytes, { contentType: 'image/png', upsert: false })

  if (upErr) {
    console.error('upload-scan-card upload error', upErr)
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data } = supabase.storage.from('site-assets').getPublicUrl(path)

  return new Response(JSON.stringify({ publicUrl: data.publicUrl }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
