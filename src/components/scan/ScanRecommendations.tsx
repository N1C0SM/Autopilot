import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, Dumbbell } from "lucide-react";
import { euro, usePlanAvailability, type PlanAvailability } from "@/lib/planCatalog";
import { isIOSNative } from "@/lib/platform";
import { hapticTap } from "@/lib/native";

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

function Recommendations({ bottleneck, improvements, monthsWithPlan }: Props) {
  const plans = usePlanAvailability();
  const { priority, limitation, rec } = recommendFor({ bottleneck, improvements, monthsWithPlan, plans });

  return (
    <section className="max-w-3xl mx-auto mb-12 px-4">
      <h2 className="type-title2">Lo que te recomendamos</h2>
      <p className="type-body mt-2">
        Lo que más te limita ahora: <span className="font-semibold">{limitation}</span>.
      </p>
      <p className="type-subhead text-muted-foreground mt-1">
        Lo primero que deberías trabajar es <span className="text-foreground">{priority || limitation}</span>.
      </p>

      <Link
        to={rec.to}
        onClick={() => void hapticTap()}
        className="flex items-start gap-4 mt-6 min-h-[44px] active:opacity-60 transition-opacity"
      >
        {rec.kind === "guia" ? (
          <BookOpen className="w-7 h-7 text-primary shrink-0" strokeWidth={1.75} />
        ) : (
          <Dumbbell className="w-7 h-7 text-primary shrink-0" strokeWidth={1.75} />
        )}
        <div className="flex-1 min-w-0">
          <div className="type-headline">
            {rec.name}{rec.price ? ` · ${rec.price}` : ""}
          </div>
          <div className="type-subhead text-muted-foreground mt-0.5">{rec.why}</div>
          <div className="type-subhead font-semibold text-primary mt-2">{rec.cta}</div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground/60 shrink-0 mt-0.5" />
      </Link>

      <p className="mt-6 type-footnote text-muted-foreground">
        {rec.kind === "guia"
          ? plans.coach ? "Si prefieres que Autopilot adapte tu plan, o que además lo revise Nicolás, mira los planes." : "Si prefieres que Autopilot adapte tu plan y tu nutrición, mira los planes."
          : "Si por ahora prefieres ir por tu cuenta, tienes las guías en PDF en Recursos."}{" "}
        <Link
          to={rec.kind === "guia" ? "/planes" : "/recursos"}
          onClick={() => void hapticTap()}
          className="text-primary active:opacity-60"
        >
          {rec.kind === "guia" ? "Ver planes" : "Ver guías"}
        </Link>
      </p>
    </section>
  );
}

export default function ScanRecommendations(props: Props) {
  // iOS v1 (reader app, App Store §3.1.3(a)): no plan recommendations in the native build.
  if (isIOSNative()) return null;
  return <Recommendations {...props} />;
}
