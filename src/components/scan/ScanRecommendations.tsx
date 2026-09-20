import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Dumbbell } from "lucide-react";

type Props = {
  bottleneck?: string;
  improvements?: { label: string; priority: string }[];
  inferredFocus?: string;
};

type Item = {
  name: string;
  price: string;
  why: string;
  to: string;
  kind: "guia" | "plan";
};

const GUIDES: Record<string, Item> = {
  base: {
    name: "Base de Fuerza",
    price: "9,90 €",
    why: "Para aprender bien lo básico y coger técnica antes de complicarte.",
    to: "/recursos",
    kind: "guia",
  },
  atlas: {
    name: "Atlas de Progresiones",
    price: "14,90 €",
    why: "Para elegir variantes y salir de un estancamiento con progresiones claras.",
    to: "/recursos",
    kind: "guia",
  },
  blueprint: {
    name: "Blueprint",
    price: "19,90 €",
    why: "Para organizar 12 semanas con orden y no improvisar cada sesión.",
    to: "/recursos",
    kind: "guia",
  },
  pack: {
    name: "Pack completo",
    price: "29,90 €",
    why: "Las tres guías juntas si quieres el material completo de una vez.",
    to: "/recursos",
    kind: "guia",
  },
};

const PLANS: Item[] = [
  {
    name: "Entrenamiento",
    price: "29 €/mes",
    why: "Un entrenador prepara tu entrenamiento y lo ajusta según tus avances.",
    to: "/signup?plan=training",
    kind: "plan",
  },
  {
    name: "Completo",
    price: "49 €/mes",
    why: "Entrenamiento, nutrición y recuperación, con seguimiento por chat.",
    to: "/signup?plan=full",
    kind: "plan",
  },
  {
    name: "Transformación",
    price: "299 €",
    why: "Proceso acompañado de 12 semanas si quieres el cambio más rápido.",
    to: "/signup?plan=transform",
    kind: "plan",
  },
];

const pickGuide = (text: string): Item => {
  const t = text.toLowerCase();
  if (/(técnica|tecnica|básic|basic|empez|principiante|fuerza|postura)/.test(t)) return GUIDES.base;
  if (/(estanc|plateau|progres|variant|ejercicio|repetic)/.test(t)) return GUIDES.atlas;
  if (/(organiz|planific|constan|rutina|volumen|frecuenc)/.test(t)) return GUIDES.blueprint;
  return GUIDES.pack;
};

export default function ScanRecommendations({ bottleneck, improvements }: Props) {
  const priority =
    improvements?.find((i) => /alta/i.test(i.priority))?.label ?? improvements?.[0]?.label ?? bottleneck ?? "";
  const limitation = bottleneck || priority || "tu punto de partida actual";
  const guide = pickGuide(`${limitation} ${priority}`);

  return (
    <div className="max-w-3xl mx-auto mb-12">
      <div className="rounded-2xl border border-primary/30 bg-card/50 backdrop-blur p-5 sm:p-6">
        <div className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">
          Qué te recomendamos
        </div>
        <p className="text-sm leading-relaxed mb-1">
          Lo que más te limita ahora: <span className="font-semibold">{limitation}</span>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          Lo primero que deberías trabajar es <span className="font-medium text-foreground">{priority || limitation}</span>.
          Abajo tienes la opción económica para hacerlo por tu cuenta y las opciones con entrenador si prefieres que
          alguien lo prepare y lo ajuste contigo.
        </p>

        <div className="space-y-3">
          <Link
            to={guide.to}
            className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 hover:border-primary/60 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">
                {guide.name} · {guide.price}
                <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  opción más económica
                </span>
              </div>
              <div className="text-[13px] text-muted-foreground leading-snug">{guide.why}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>

          {PLANS.map((p) => (
            <Link
              key={p.name}
              to={p.to}
              className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 hover:border-primary/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <Dumbbell className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">
                  {p.name} · {p.price}
                </div>
                <div className="text-[13px] text-muted-foreground leading-snug">{p.why}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Las guías son material para seguir solo. Los planes incluyen entrenador real: prepara tu plan, habla contigo y
          lo ajusta según tus avances.
        </p>
      </div>
    </div>
  );
}
