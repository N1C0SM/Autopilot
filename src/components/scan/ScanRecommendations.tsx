import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Dumbbell } from "lucide-react";

type Props = {
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
    name: "Base de Fuerza",
    price: "9,90 €",
    why: "Lo primero para ti es la técnica y los básicos. Esta guía te los enseña paso a paso.",
    to: "/recursos",
    cta: "Ver la guía",
    kind: "guia",
  },
  atlas: {
    name: "Atlas de Progresiones",
    price: "14,90 €",
    why: "Estás estancado: aquí tienes las variantes y progresiones para volver a avanzar.",
    to: "/recursos",
    cta: "Ver la guía",
    kind: "guia",
  },
  blueprint: {
    name: "Blueprint",
    price: "19,90 €",
    why: "Te falta orden más que esfuerzo. Con esto organizas tus próximas 12 semanas.",
    to: "/recursos",
    cta: "Ver la guía",
    kind: "guia",
  },
};

const PLANS: Record<string, Item> = {
  training: {
    name: "Entrenamiento",
    price: "29 €/mes",
    why: "Un entrenador real prepara tu entrenamiento y lo ajusta cada semana según tus avances.",
    to: "/signup?plan=training",
    cta: "Empezar con entrenador",
    kind: "plan",
  },
  full: {
    name: "Completo",
    price: "49 €/mes",
    why: "Entrenamiento y nutrición preparados por un entrenador real, con seguimiento por chat.",
    to: "/signup?plan=full",
    cta: "Empezar con entrenador",
    kind: "plan",
  },
  transform: {
    name: "Transformación",
    price: "299 €",
    why: "12 semanas acompañadas de principio a fin: es el camino más rápido para tu punto de partida.",
    to: "/signup?plan=transform",
    cta: "Ver Transformación",
    kind: "plan",
  },
};

// Una sola recomendación: el plan que encaja, y si no toca plan, un libro.
const pick = (text: string, monthsWithPlan?: number): Item => {
  const t = text.toLowerCase();
  const nutrition = /(grasa|graso|abdomen|cintura|definic|peso|dieta|nutric|aliment|barriga)/.test(t);
  const long = typeof monthsWithPlan === "number" && monthsWithPlan >= 6;

  if (nutrition && long) return PLANS.transform;
  if (nutrition) return PLANS.full;
  if (/(técnica|tecnica|básic|basic|postura|principiante|empez)/.test(t)) return GUIDES.base;
  if (/(estanc|plateau|progres|variant)/.test(t)) return GUIDES.atlas;
  if (/(organiz|planific|constan|rutina|frecuenc|volumen)/.test(t)) return GUIDES.blueprint;
  return PLANS.training;
};

export default function ScanRecommendations({ bottleneck, improvements, monthsWithPlan }: Props) {
  const priority =
    improvements?.find((i) => /alta/i.test(i.priority))?.label ?? improvements?.[0]?.label ?? bottleneck ?? "";
  const limitation = bottleneck || priority || "tu punto de partida actual";
  const rec = pick(`${limitation} ${priority}`, monthsWithPlan);

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
              {rec.name} · {rec.price}
            </div>
            <div className="text-[13px] text-muted-foreground leading-snug mt-0.5">{rec.why}</div>
            <div className="text-[12px] text-primary font-medium mt-2">{rec.cta}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>

        <p className="mt-4 text-[11px] text-muted-foreground">
          {rec.kind === "guia"
            ? "Si prefieres que alguien lo prepare y lo ajuste contigo, puedes ver los planes con entrenador real."
            : "Si por ahora prefieres ir por tu cuenta, tienes las guías desde 9,90 € en Recursos."}{" "}
          <Link
            to={rec.kind === "guia" ? "/#planes" : "/recursos"}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {rec.kind === "guia" ? "Ver planes" : "Ver guías"}
          </Link>
        </p>
      </div>
    </div>
  );
}
