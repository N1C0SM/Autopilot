import ScrollReveal from "@/components/ScrollReveal";
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import { isIOSNative } from "@/lib/platform";

/** "App or accompaniment?" — only meaningful while Coach is published, so it hides itself otherwise. */
const ComparisonTable = () => {
  // iOS v1 (reader app, App Store §3.1.3(a)): no pricing comparison in the native build.
  if (isIOSNative()) return null;
  const p = usePlanAvailability();
  if (!p.coach) return null;
  return (
    <section className="px-4 py-16">
      <div className="container mx-auto max-w-5xl">
        <ScrollReveal>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Elige el tipo de ayuda</p>
          <h2 className="max-w-2xl font-display text-3xl font-bold sm:text-4xl">¿Te basta una app o buscas acompañamiento?</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="border-t border-border pt-5">
              <h3 className="font-display text-lg font-semibold">Si ya sabes organizar tu entrenamiento</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Una app para registrar sesiones o generar rutinas puede ser suficiente. Muchas adaptan ejercicios, material y dificultad. Si solo necesitas eso, quizá no necesites un servicio con entrenador.</p>
            </div>
            <div className="border-t border-primary pt-5">
              <h3 className="font-display text-lg font-semibold">Si quieres que alguien revise contigo</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {p.coachName} añade a Nicolás revisando tu plan y chat directo por {euro(p.coachPrice)}/mes.
                {p.plus && <> {p.plusName}, por {euro(p.plusPrice)}/mes, incluye nutrición y progresión automática; no incluye atención humana.</>}
              </p>
            </div>
          </div>
          <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">Free incluye rutina inicial, registro y progreso. La nutrición está incluida en {p.plus ? `${p.plusName} y ${p.coachName}` : p.coachName}. El acompañamiento de {p.coachName} es online y no incluye supervisión presencial de cada sesión ni sustituye atención médica o rehabilitación.</p>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default ComparisonTable;
