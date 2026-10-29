// Public copy that depends on which plans the admin has published.
// Pure data (no React/Supabase imports): the app and the build-time prerender share it,
// so hiding Coach in Admin → Planes removes it from the page, the FAQs and the structured data alike.
import { euro, type PlanAvailability } from "./planCatalogCore";
import { COACH_CONTACT_CHANNEL } from "../config/tiers";

export type PlanFlags = Pick<PlanAvailability, "coach" | "plus" | "coachName" | "plusName" | "coachPrice" | "plusPrice" | "paidNames" | "campaign">;
export type Faq = { q: string; a: string };

export const SITE_URL = "https://autopilotplan.com";
export const SITE_NAME = "Autopilot";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

const planNames = (p: PlanFlags) => ["Free", p.plus && p.plusName, p.coach && p.coachName].filter(Boolean) as string[];
const listEs = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}` : items[0] ?? "");
const trialSentence = (p: PlanFlags) =>
  `${p.paidNames} ${p.plus && p.coach ? "piden" : "pide"} tarjeta al empezar una prueba de 7 días. No se cobra nada hasta el día 8. Puedes cancelar antes desde Ajustes → Suscripción y no se te cobrará. Después se renueva cada mes, sin permanencia.`;

/** Short FAQ block of the landing page. */
export function landingFaqs(p: PlanFlags): Faq[] {
  const names = planNames(p);
  return [
    { q: "¿Qué incluye el plan Free?", a: "Rutina inicial según tu objetivo, días y material, registro de series, kg y repeticiones, historial, peso y récords. No pide tarjeta y no caduca." },
    {
      q: names.length > 1 ? `¿Qué diferencia hay entre ${listEs(names)}?` : "¿Qué incluye Autopilot?",
      a: [
        p.campaign ? "Free incluye rutina, registro, progreso, sobrecarga progresiva y objetivos de nutrición básica sin tarjeta." : "Free sirve para entrenar y registrar.",
        p.plus && `${p.plusName} (${euro(p.plusPrice)}/mes) añade plan de nutrición con calorías y macros, progresión de cargas calculada con tus registros, análisis corporal por foto con IA y estadísticas avanzadas.`,
        p.coach && `${p.coachName} (${euro(p.coachPrice)}/mes) incluye todo ${p.plus ? p.plusName : "lo anterior"} y a Nicolás revisando tu plan y respondiéndote ${COACH_CONTACT_CHANNEL}.`,
      ].filter(Boolean).join(" "),
    },
    { q: "¿Puedo entrenar en casa o hacer calistenia?", a: "Sí. Indicas tu material exacto, o ninguno, y la rutina se construye con ejercicios que puedes hacer: gimnasio, mancuernas en casa o calistenia." },
    ...(p.plus || p.coach ? [{ q: "¿Cómo funcionan los pagos y la cancelación?", a: trialSentence(p) }] : []),
  ];
}

/** Full FAQ page (/preguntas-frecuentes). */
export function publicFaqs(p: PlanFlags): Faq[] {
  const names = planNames(p);
  const coachExtra = (text: string) => (p.coach ? ` ${text}` : "");
  const faqs: (Faq | false)[] = [
    {
      q: names.length > 1 ? `¿Qué diferencia hay entre ${listEs(names)}?` : "¿Qué incluye Autopilot?",
      a: [
        p.campaign ? "Free incluye rutina inicial, registro, progreso, sobrecarga progresiva y objetivos de nutrición básica, sin tarjeta." : "Free incluye rutina inicial, registro de entrenamientos y progreso, sin tarjeta.",
        p.plus && `${p.plusName} (${euro(p.plusPrice)}/mes) añade plan de nutrición, progresión de cargas calculada con tus registros, análisis corporal por foto con IA y estadísticas avanzadas.`,
        p.coach && `${p.coachName} (${euro(p.coachPrice)}/mes) añade además a Nicolás, el fundador, que revisa tu plan y te responde ${COACH_CONTACT_CHANNEL}.`,
      ].filter(Boolean).join(" "),
    },
    { q: "¿La demo me crea una cuenta o me cobra?", a: "No. La demo muestra capturas reales de la app y puedes explorarla sin registrarte. Para guardar tus propios entrenamientos, crea una cuenta gratis." },
    (p.plus || p.coach) && {
      q: "¿Qué ocurre al terminar los 7 días de prueba?",
      a: `Los planes de pago empiezan con 7 días de prueba: se pide tarjeta al contratar, no se cobra nada hasta el día 8 y puedes cancelar antes desde Ajustes → Suscripción para evitar el primer cobro. Si no cancelas, la suscripción se renueva a ${[p.plus && `${euro(p.plusPrice)}/mes (${p.plusName})`, p.coach && `${euro(p.coachPrice)}/mes (${p.coachName})`].filter(Boolean).join(" o ")}. El plan Free no tiene prueba ni tarjeta.`,
    },
    { q: "¿El análisis inicial es gratis?", a: "Sí. El análisis corporal inicial con IA es gratis, sin tarjeta y sin necesidad de crear una cuenta." },
    { q: "¿Necesito tarjeta para hacer el análisis?", a: "No. Solo necesitas una foto. El tiempo del análisis puede variar." },
    {
      q: "¿Qué pasa después del análisis?",
      a: `Recibes un análisis visual estimado por IA y puedes crear tu rutina gratis.${p.plus ? ` Con ${p.plusName}, Autopilot añade tu plan de nutrición y calcula la progresión de cargas con tus registros.` : ""}${coachExtra(`Con ${p.coachName}, además, Nicolás estudia tu caso, se comunica contigo ${COACH_CONTACT_CHANNEL} y ajusta el plan.`)}`,
    },
    p.plus && p.coach && { q: "¿Puedo tener nutrición sin entrenador?", a: `Sí. ${p.plusName} (${euro(p.plusPrice)}/mes) incluye nutrición y progresión automática, sin atención humana.` },
    p.coach && { q: `¿Qué incluye el plan ${p.coachName}?`, a: `${p.coachName} (${euro(p.coachPrice)}/mes) incluye todo lo de ${p.plus ? p.plusName : "Free"} y añade a Nicolás, el fundador: revisa tu plan, lo ajusta si cambian tus horarios o tu material y te responde ${COACH_CONTACT_CHANNEL} en horario normal, no 24/7.` },
    {
      q: "¿Quién prepara y ajusta mi plan?",
      a: `La rutina se genera con reglas de entrenamiento fijas a partir de tu objetivo, nivel, días y material.${p.plus ? ` En ${p.plusName}, la progresión de cargas se calcula con lo que registras.` : ""}${coachExtra(`En ${p.coachName}, además, Nicolás revisa tu caso, ajusta el plan y responde a tus dudas ${COACH_CONTACT_CHANNEL}.`)}`,
    },
    (p.plus || p.coach) && { q: "¿Puedo cancelar cuando quiera?", a: "Sí. Los planes mensuales se renuevan automáticamente hasta que cancelas desde Ajustes → Suscripción. Sin permanencia." },
    { q: "¿Y si entreno en casa?", a: `Sin problema. Indicas tu material exacto y la rutina se construye sobre esa base: calistenia, mancuernas en casa o cero material.${coachExtra(`Con ${p.coachName}, Nicolás lo revisa contigo.`)}` },
    { q: "¿Y si nunca he entrenado?", a: `La rutina parte de tu nivel real y progresa paso a paso, sin saltar fases.${coachExtra(`Con ${p.coachName}, Nicolás la supervisa.`)}` },
    { q: "¿En qué se diferencia de ChatGPT o de una rutina de YouTube?", a: `ChatGPT te da un texto y YouTube una rutina genérica. Autopilot construye tu rutina con tus datos reales (nivel, material, días) y guarda cada serie para que veas tu progreso.${coachExtra(`Con ${p.coachName}, además, hay una persona real que revisa tu caso.`)}` },
    { q: "¿Y si me voy de viaje o pierdo una semana?", a: `Retomas donde lo dejaste y puedes cambiar los días o el material desde la app.${coachExtra(`Con ${p.coachName}, lo avisas ${COACH_CONTACT_CHANNEL} y Nicolás reorganiza el plan.`)} Si hay una lesión, consulta con un profesional sanitario antes de continuar.` },
    { q: "¿Y si veo que no es para mí?", a: `Empieza con el plan Free, sin tarjeta.${p.plus || p.coach ? " Los planes de pago tienen 7 días de prueba: se pide tarjeta y no se cobra hasta el día 8, así que puedes cancelar antes sin coste." : ""}` },
  ];
  return faqs.filter(Boolean) as Faq[];
}

/** Title/description of the info pages, shared by the app and the prerendered HTML. */
export function publicPageMeta(p: PlanFlags) {
  const paid = [p.plus && `${p.plusName} añade nutrición y progresión de cargas`, p.coach && `${p.coachName} suma a Nicolás revisando tu plan`].filter(Boolean);
  return {
    plans: {
      title: "Planes y precios",
      description: `Empieza gratis, sin tarjeta.${paid.length ? ` ${paid.join("; ")}. 7 días de prueba y sin permanencia.` : ""}`,
    },
    how: { title: "Así funciona Autopilot", description: "Tu objetivo, tu rutina y tu progreso. Mira cómo se usa la app antes de crear tu cuenta." },
    team: {
      title: "Quién está detrás de Autopilot",
      description: p.coach
        ? `Conoce a Nicolás San Marcos, fundador de Autopilot, que te atiende en el plan ${p.coachName}.`
        : "Conoce a Nicolás San Marcos, fundador y desarrollador de Autopilot.",
    },
    faq: { title: "Preguntas frecuentes", description: `Resuelve tus dudas sobre los planes, el entrenamiento, ${p.plus || p.coach ? "la prueba de 7 días" : "el plan gratis"} y tu cuenta.` },
  } as const;
}

export const LANDING_META = {
  title: "App de entrenamiento y nutrición. Empieza gratis",
  description: "Crea tu rutina según tu objetivo, días y material, registra cada serie y sigue tu progreso en el gimnasio o en casa. Gratis, sin tarjeta.",
};

export function landingDescription(p: PlanFlags) {
  return p.plus
    ? `${LANDING_META.description.replace(" Gratis, sin tarjeta.", "")} Free sin tarjeta; ${p.plusName} añade nutrición y progresión de cargas.`
    : LANDING_META.description;
}
