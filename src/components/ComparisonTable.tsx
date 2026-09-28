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
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Autopilot combina el registro del entrenamiento con un plan preparado por una persona y chat para hablar de tus dudas. Ese seguimiento es lo que estás contratando desde {TIERS.training.price}€/mes.</p>
          </div>
        </div>
        <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">El acompañamiento es online. No incluye supervisión presencial de cada sesión ni sustituye atención médica o rehabilitación. La nutrición está incluida en Completo y Transformación.</p>
      </ScrollReveal>
    </div>
  </section>
);

export default ComparisonTable;
