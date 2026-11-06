import type { LucideIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { hapticTap } from "@/shared/lib/native";

export interface ProgressHeroPerk {
  icon: LucideIcon;
  text: string;
}

interface Props {
  /** Foto real de marca (`BRAND_PHOTOS`). */
  photo: string;
  eyebrow: string;
  title: string;
  message: string;
  /** Lo que tendrá la sección (solo funciones reales). */
  perks: ProgressHeroPerk[];
  action?: { label: string; onClick: () => void };
  /** Encuadre de la foto (`object-position`). */
  photoPosition?: string;
}

/**
 * Portada de una sección vacía de Progreso (Fuerza, Físico y Récords): foto real, titular,
 * lo que tendrá aquí y una acción. Es `progressHero` de la app nativa.
 */
export function ProgressHero({ photo, eyebrow, title, message, perks, action, photoPosition = "50% 35%" }: Props) {
  const titleId = `progress-hero-${eyebrow.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={titleId} className="overflow-hidden rounded-[28px] bg-card ring-1 ring-primary/15">
      <div className="relative h-52">
        <img src={photo} alt="" decoding="async" style={{ objectPosition: photoPosition }} className="absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-card via-black/45 to-black/10" />
        <div className="absolute inset-x-5 bottom-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
          <h2 id={titleId} className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-white">{title}</h2>
        </div>
      </div>
      <div className="px-5 pb-5 pt-2">
        <p className="type-subhead text-muted-foreground">{message}</p>
        <ul className="mt-4 space-y-3">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 type-subhead">
              <Icon className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />{text}
            </li>
          ))}
        </ul>
        {action && (
          <Button
            size="lg"
            className="mt-5 w-full"
            onClick={() => {
              void hapticTap();
              action.onClick();
            }}
          >
            {action.label}
          </Button>
        )}
      </div>
    </section>
  );
}
