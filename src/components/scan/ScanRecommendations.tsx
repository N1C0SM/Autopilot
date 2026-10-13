import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Dumbbell } from "lucide-react";
import { euro, usePlanAvailability, type PlanAvailability } from "@/lib/planCatalog";
import { isIOSNative } from "@/lib/platform";

type Props = {
  /** Published plans; Coach is never recommended while it is hidden in Admin. */
  plans?: Pick<PlanAvailability, "coach" | "plus" | "coachName" | "plusName" | "coachPrice" | "plusPrice">;
  bottleneck?: string;
  improvements?: { label: string; priority: string }[];
  monthsWithPlan?: number;
};

type Item = {
  name: string;
  price: string;
  why: string;
  to: string;
  cta: string;
  kind: "guia" | "plan";
};

const GUIDES: Record<string, Item> = {
  base: {
    name: "Guía: técnica y básicos",
    price: "",
    why: "Lo primero para ti es la técnica y los básicos. En Recursos tienes las guías en PDF del equipo.",
    to: "/recursos",
    cta: "Ver en Recursos",
    kind: "guia",
  },
  atlas: {
    name: "Guía: progresiones",
    price: "",
    why: "Estás estancado: en Recursos tienes material sobre variantes y progresiones para volver a avanzar.",
    to: "/recursos",
    cta: "Ver en Recursos",
    kind: "guia",
  },
  blueprint: {
    name: "Guía: planificación",
    price: "",
    why: "Te falta orden más que esfuerzo. En Recursos tienes guías para organizar tus próximas semanas.",
    to: "/recursos",
    cta: "Ver en Recursos",
    kind: "guia",
  },
};

const DEFAULT_PLANS: NonNullable<Props["plans"]> = { coach: true, plus: true, coachName: "Coach", plusName: "Plus", coachPrice: 49, plusPrice: 29 };

const plansFor = (p: NonNullable<Props["plans"]>): Record<"training" | "full", Item> => ({
  training: {
    name: p.plusName,
    price: `${euro(p.plusPrice)}/mes`,
    why: "Autopilot genera tu entrenamiento, calcula la progresión de cargas con tus registros y añade tu plan de nutrición.",
    to: "/signup?plan=training",
    cta: `Empezar con ${p.plusName}`,
    kind: "plan",
  },
  full: {
    name: p.coachName,
    price: `${euro(p.coachPrice)}/mes`,
    why: `Todo lo de ${p.plus ? p.plusName : "Free"} y, además, Nicolás revisa tu plan y te responde por chat.`,
    to: "/signup?plan=full",
    cta: `Empezar con ${p.coachName}`,
    kind: "plan",
  },
});

// Una sola recomendación: el plan que encaja, y si no toca plan, un libro.
const pick = (text: string, _monthsWithPlan: number | undefined, p: NonNullable<Props["plans"]>): Item => {
  const PLANS = plansFor(p);
  const paid = p.coach ? PLANS.full : PLANS.training;
  const base = p.plus ? PLANS.training : p.coach ? PLANS.full : GUIDES.blueprint;
  const t = text.toLowerCase();
  const nutrition = /(grasa|graso|abdomen|cintura|definic|peso|dieta|nutric|aliment|barriga)/.test(t);

  if (nutrition && (p.plus || p.coach)) return paid;
  if (/(técnica|tecnica|básic|basic|postura|principiante|empez)/.test(t)) return GUIDES.base;
  if (/(estanc|plateau|progres|variant)/.test(t)) return GUIDES.atlas;
  if (/(organiz|planific|constan|rutina|frecuenc|volumen)/.test(t)) return GUIDES.blueprint;
  return base;
};

/** Misma lógica que el bloque de recomendación, reutilizable por la página de resultados. */
export function recommendFor({ bottleneck, improvements, monthsWithPlan, plans = DEFAULT_PLANS }: Props) {
  const priority =
    improvements?.find((i) => /alta/i.test(i.priority))?.label ?? improvements?.[0]?.label ?? bottleneck ?? "";
  const limitation = bottleneck || priority || "tu punto de partida actual";
  return { priority, limitation, rec: pick(`${limitation} ${priority}`, monthsWithPlan, plans) };
}

export default function ScanRecommendations({ bottleneck, improvements, monthsWithPlan }: Props) {
  // iOS v1 (reader app, App Store §3.1.3(a)): no plan recommendations in the native build.
  if (isIOSNative()) return null;
  const plans = usePlanAvailability();
  const { priority, limitation, rec } = recommendFor({ bottleneck, improvements, monthsWithPlan, plans });

  return (
    <div className="max-w-3xl mx-auto mb-12">
      <div className="rounded-2xl border border-primary/30 bg-card/50 backdrop-blur p-5 sm:p-6">
        <div className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">
          Lo que te recomendamos
        </div>
        <p className="text-sm leading-relaxed mb-1">
          Lo que más te limita ahora: <span className="font-semibold">{limitation}</span>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          Lo primero que deberías trabajar es{" "}
          <span className="font-medium text-foreground">{priority || limitation}</span>.
        </p>

        <Link
          to={rec.to}
          className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 px-4 py-4 hover:border-primary/60 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            {rec.kind === "guia" ? (
              <BookOpen className="w-4 h-4 text-primary" />
            ) : (
              <Dumbbell className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {rec.name}{rec.price ? ` · ${rec.price}` : ""}
            </div>
            <div className="text-[13px] text-muted-foreground leading-snug mt-0.5">{rec.why}</div>
            <div className="text-[12px] text-primary font-medium mt-2">{rec.cta}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>

        <p className="mt-4 text-[11px] text-muted-foreground">
          {rec.kind === "guia"
            ? plans.coach ? "Si prefieres que Autopilot adapte tu plan, o que además lo revise Nicolás, mira los planes." : "Si prefieres que Autopilot adapte tu plan y tu nutrición, mira los planes."
            : "Si por ahora prefieres ir por tu cuenta, tienes las guías en PDF en Recursos."}{" "}
          <Link
            to={rec.kind === "guia" ? "/planes" : "/recursos"}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {rec.kind === "guia" ? "Ver planes" : "Ver guías"}
          </Link>
        </p>
      </div>
    </div>
  );
}
