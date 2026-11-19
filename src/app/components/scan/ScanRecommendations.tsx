import { Link } from "react-router-dom";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { BookOpen, Dumbbell } from "lucide-react";
import { euro, usePlanAvailability, type PlanAvailability } from "@/shared/lib/planCatalog";
import { isIOSNative } from "@/shared/lib/platform";
import { hapticTap } from "@/shared/lib/native";

type Props = {
  /** Planes publicados: solo Gratis y Plus (Plus no se recomienda si está oculto en Admin). */
  plans?: Pick<PlanAvailability, "plus" | "plusName" | "plusPrice">;
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

const DEFAULT_PLANS: NonNullable<Props["plans"]> = { plus: true, plusName: "Plus", plusPrice: 29 };

const plusFor = (p: NonNullable<Props["plans"]>): Item => ({
  name: p.plusName,
  price: `${euro(p.plusPrice)}/mes`,
  why: "Autopilot genera tu entrenamiento, calcula la progresión de cargas con tus registros y añade tu plan de nutrición.",
  to: "/signup?plan=training",
  cta: `Empezar con ${p.plusName}`,
  kind: "plan",
});

// Una sola recomendación: Plus si encaja (y está publicado) y, si no toca plan, una guía.
const pick = (text: string, _monthsWithPlan: number | undefined, p: NonNullable<Props["plans"]>): Item => {
  const plus = plusFor(p);
  const base = p.plus ? plus : GUIDES.blueprint;
  const t = text.toLowerCase();
  const nutrition = /(grasa|graso|abdomen|cintura|definic|peso|dieta|nutric|aliment|barriga)/.test(t);

  if (nutrition && p.plus) return plus;
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

/** «Lo que te recomendamos»: lo que más te limita y una sola recomendación en una tarjeta sin borde. */
function Recommendations({ bottleneck, improvements, monthsWithPlan }: Props) {
  const plans = usePlanAvailability();
  const { priority, limitation, rec } = recommendFor({ bottleneck, improvements, monthsWithPlan, plans });
  // La IA escribe frases completas: sin punto final duplicado ni la misma frase dos veces.
  const clean = (s: string) => s.trim().replace(/\.+$/, "");
  const first = priority && clean(priority) !== clean(limitation) ? clean(priority) : "";

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="type-title3">Lo que te recomendamos</h2>
      <div className="rounded-card bg-card p-4">
        <p className="type-footnote text-muted-foreground">Lo que más te limita ahora</p>
        <p className="mt-0.5 type-body">{clean(limitation)}.</p>
        {first && (
          <>
            <p className="mt-3 type-footnote text-muted-foreground">Lo primero que deberías trabajar</p>
            <p className="mt-0.5 type-body">{first}.</p>
          </>
        )}
        <Link
          to={rec.to}
          onClick={() => void hapticTap()}
          className="mt-4 flex min-h-[44px] items-start gap-3.5 sep-t pt-4 transition-opacity active:opacity-60"
        >
          <IconTile icon={rec.kind === "guia" ? BookOpen : Dumbbell} size="md" />
          <div className="min-w-0 flex-1">
            <div className="type-headline">
              {rec.name}{rec.price ? <span className="whitespace-nowrap"> · {rec.price}</span> : null}
            </div>
            <div className="mt-0.5 type-subhead text-muted-foreground">{rec.why}</div>
            <div className="mt-2 type-headline text-primary">{rec.cta}</div>
          </div>
        </Link>
      </div>

      <p className="type-footnote text-muted-foreground">
        {rec.kind === "guia"
          ? "Si prefieres que Autopilot adapte tu plan y tu nutrición, mira los planes."
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
  // iOS v1 (App Store §3.1.1: sin venta de bienes digitales; §3.1.3(a) no cubre fitness): no plan recommendations in the native build.
  if (isIOSNative()) return null;
  return <Recommendations {...props} />;
}
