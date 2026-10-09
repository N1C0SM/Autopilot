import { TIERS } from "@/config/tiers";
import ScrollReveal from "@/components/ScrollReveal";

const ComparisonTable = () => (
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
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Coach añade un entrenador asignado, revisiones y chat directo por {TIERS.full.price}€/mes. Plus, por {TIERS.training.price}€/mes, incluye adaptación con IA y nutrición; no incluye entrenador humano.</p>
          </div>
        </div>
        <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">Free incluye rutina inicial, registro y progreso. La nutrición está incluida en Plus y Coach. El acompañamiento de Coach es online y no incluye supervisión presencial de cada sesión ni sustituye atención médica o rehabilitación.</p>
      </ScrollReveal>
    </div>
  </section>
);

export default ComparisonTable;
