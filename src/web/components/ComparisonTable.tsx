import { euro, usePlanAvailability } from "@/shared/lib/planCatalog";
import { isIOSNative } from "@/shared/lib/platform";

/** "App or accompaniment?" — only meaningful while Coach is published, so it hides itself otherwise. */
const ComparisonTable = () => {
  // iOS v1 (App Store §3.1.1: sin venta de bienes digitales; §3.1.3(a) no cubre fitness): no pricing comparison in the native build.
  if (isIOSNative()) return null;
  return <ComparisonTableContent />;
};

const ComparisonTableContent = () => {
  const p = usePlanAvailability();
  if (!p.coach) return null;
  return (
    <section className="py-8">
      <div className="mx-auto max-w-5xl">
        <p className="type-subhead text-primary">Elige el tipo de ayuda</p>
        <h2 className="mt-1 max-w-2xl type-title1">¿Te basta una app o buscas acompañamiento?</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <h3 className="type-title3">Si ya sabes organizar tu entrenamiento</h3>
            <p className="mt-2 type-subhead text-muted-foreground">Una app para registrar sesiones o generar rutinas puede ser suficiente. Muchas adaptan ejercicios, material y dificultad. Si solo necesitas eso, quizá no necesites un servicio con entrenador.</p>
          </div>
          <div>
            <h3 className="type-title3 text-primary">Si quieres que alguien revise contigo</h3>
            <p className="mt-2 type-subhead text-muted-foreground">
              {p.coachName} añade a Nicolás revisando tu plan y chat directo por {euro(p.coachPrice)}/mes.
              {p.plus && <> {p.plusName}, por {euro(p.plusPrice)}/mes, incluye nutrición y progresión automática; no incluye atención humana.</>}
            </p>
          </div>
        </div>
        <p className="mt-8 type-footnote text-muted-foreground">Free incluye rutina inicial, registro y progreso. La nutrición está incluida en {p.plus ? `${p.plusName} y ${p.coachName}` : p.coachName}. El acompañamiento de {p.coachName} es online y no incluye supervisión presencial de cada sesión ni sustituye atención médica o rehabilitación.</p>
      </div>
    </section>
  );
};

export default ComparisonTable;
