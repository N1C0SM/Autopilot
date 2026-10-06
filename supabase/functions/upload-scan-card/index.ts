import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_BYTES = 4 * 1024 * 1024 // ~4MB de PNG ya decodificado
// El cuerpo llega en base64 (~33% más grande): cortamos antes de decodificar nada.
const MAX_CONTENT_LENGTH_BYTES = 6 * 1024 * 1024

// Bucket PRIVADO. La tarjeta compartible incluye la foto del usuario: nunca debe
// quedar accesible de forma permanente y anónima (el bucket público anterior
// convertía esta función en hosting gratuito de imágenes).
const BUCKET = 'progress-photos'
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7

const RL_WINDOW_SECONDS = 60
const RL_LIMIT_IP = 8 // usuarios anónimos (sin sesión)
const RL_LIMIT_USER = 20 // usuarios con sesión válida

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function rateLimited(
  supabase: ReturnType<typeof createClient>,
  key: string,
  limit: number,
): Promise<boolean> {
  const sinceIso = new Date(Date.now() - RL_WINDOW_SECONDS * 1000).toISOString()
  const { count } = await supabase
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('key', key)
    .gte('created_at', sinceIso)
  if ((count ?? 0) >= limit) return true
  await supabase.from('rate_limits').insert({ key })
  return false
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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // 1) Tamaño declarado, antes de leer y decodificar el cuerpo.
  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTENT_LENGTH_BYTES) {
    return json({ error: 'Image too large' }, 413)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // 2) Identidad: si llega un JWT de usuario lo validamos; la clave anónima (o la
  //    ausencia de cabecera) significa "escaneo sin registro", que sigue permitido.
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  let userId: string | null = null
  if (bearer && bearer !== anonKey) {
    const { data, error } = await createClient(supabaseUrl, anonKey || serviceRoleKey)
      .auth
      .getUser(bearer)
    if (error || !data?.user) {
      // Sin SUPABASE_ANON_KEY en el entorno no podemos distinguir una petición
      // anónima legítima: degradamos a anónimo (con su límite) en vez de romper
      // el escaneo sin registro.
      if (anonKey) return json({ error: 'Invalid session' }, 401)
    } else {
      userId = data.user.id
    }
  }

  // 3) Límite por usuario cuando hay sesión, y siempre por IP.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (userId && (await rateLimited(supabase, `upload-scan-card:user:${userId}`, RL_LIMIT_USER))) {
    return json({ error: 'Too many requests' }, 429)
  }
  if (await rateLimited(supabase, `upload-scan-card:${ip}`, RL_LIMIT_IP)) {
    return json({ error: 'Too many requests' }, 429)
  }

  let pngBase64: string | undefined
  try {
    const body = await req.json()
    pngBase64 = body?.pngBase64
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (!pngBase64 || typeof pngBase64 !== 'string') {
    return json({ error: 'pngBase64 required' }, 400)
  }

  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(pngBase64)
  } catch {
    return json({ error: 'Invalid base64' }, 400)
  }

  if (bytes.length > MAX_BYTES) return json({ error: 'Image too large' }, 413)
  if (!isPng(bytes)) return json({ error: 'Not a PNG' }, 400)

  // 4) Carpeta del usuario cuando la hay; si no, carpeta anónima separada.
  const ownerFolder = userId ? `scan-cards/${userId}` : 'scan-cards/anonymous'
  const path = `${ownerFolder}/${crypto.randomUUID()}.png`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/png', upsert: false })

  if (upErr) {
    console.error('upload-scan-card upload error', upErr)
    return json({ error: 'Upload failed' }, 500)
  }

  // 5) Devolvemos la ruta más una URL firmada temporal, que es lo que viaja en el
  //    email: el objeto sigue siendo privado una vez caduque.
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC)

  if (signErr || !signed?.signedUrl) {
    console.error('upload-scan-card sign error', signErr)
    return json({ error: 'Upload failed' }, 500)
  }

  return json({ path, signedUrl: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SEC }, 200)
})
