import { sendFeatureEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { getAuthedUser } from '../_shared/require-user.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function buildContent(answers: Record<string, unknown>) {
  const goal = String(answers.goal ?? 'gain_muscle')
  const problem = String(answers.problem ?? 'consistency')
  const equip = String(answers.equipment ?? 'mixed')

  const insightByProblem: Record<string, string> = {
    consistency:
      'Tu mayor bloqueo no es el plan: es la constancia. Por eso necesitas ver qué tocar cada día sin pensarlo.',
    guidance:
      'No te falta esfuerzo, te falta saber exactamente qué tocar cada día.',
    results:
      'Llevas meses entrenando sin progresión clara. Necesitas reglas de volumen y fatiga.',
    injuries:
      'Tu lesión no debería detenerte. Necesitas un plan que adapte cada ejercicio.',
  }
  const mistakeByGoal: Record<string, string> = {
    lose_fat: 'Estás haciendo demasiado cardio y poca proteína. Te frena más de lo que ayuda.',
    gain_muscle: 'Entrenas duro pero comes por debajo de mantenimiento. No vas a crecer.',
    performance: 'Saltas de un programa a otro cada 3 semanas. La fuerza necesita continuidad.',
    health: 'Buscas el plan perfecto en lugar de empezar uno que puedas mantener 6 meses.',
  }
  const actionByEquip: Record<string, string> = {
    gym: 'Esta semana fija 4 entrenos en tu calendario y mide solo eso.',
    calisthenics: 'Hoy haz 3 series de la progresión más fácil que aún te exige.',
    mixed: 'Esta semana entrena 4 días y come 1.6 g de proteína por kilo.',
  }

  return {
    insight: insightByProblem[problem] ?? insightByProblem.consistency,
    mistake: mistakeByGoal[goal] ?? mistakeByGoal.gain_muscle,
    action: actionByEquip[equip] ?? actionByEquip.mixed,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const answers = (body.answers ?? {}) as Record<string, unknown>

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const caller = await getAuthedUser(req)
    if (!caller || !caller.email || caller.email.toLowerCase() !== email) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    const leadInsert = await supabase
      .from('leads')
      .insert({ email, source: 'mini-plan', quiz_answers: answers })
      .select('id')
      .single()

    const leadId = leadInsert.data?.id ?? crypto.randomUUID()
    const content = buildContent(answers)

    const sendRes = await sendFeatureEmail({
        templateName: 'mini-plan',
        recipientEmail: email,
        idempotencyKey: `mini-plan-${leadId}`,
        templateData: content,
      })

    if (sendRes.error) {
      return new Response(JSON.stringify({ error: sendRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})