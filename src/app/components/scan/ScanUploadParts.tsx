import { AlertCircle, Camera, Check, Lock, PersonStanding, Plus, RotateCcw, Ruler, Shirt, Sun, X, type LucideIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { keepTogether } from "@/shared/lib/scanResultFormat";

/**
 * Piezas de la subida del scan, iguales en Progreso → Scan, el scan público y la app
 * (`ScanView.swift`): las dos fotos, «Cómo tomar las fotos», el físico objetivo, el aviso de error
 * y la nota de privacidad.
 */

const SCAN_TIPS: { icon: LucideIcon; text: string }[] = [
  { icon: PersonStanding, text: "Cuerpo entero, de pie y con el móvil en vertical" },
  { icon: Ruler, text: "Cámara a 2-3 m, a la altura del ombligo" },
  { icon: Sun, text: "Luz natural frontal, sin contraluz ni flash" },
  { icon: Shirt, text: "Ropa ajustada y fondo liso y claro" },
  { icon: RotateCcw, text: "Para la de atrás, date la vuelta sin moverte" },
];

/** Cabecera de sección alineada a la izquierda, como «Tu fuerza» en Progreso. */
export function ScanHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-0.5">
      <h2 className="type-title3">{title}</h2>
      <p className="type-subhead text-muted-foreground">{subtitle}</p>
    </header>
  );
}

/** Hueco de una foto: tarjeta de 28 sin borde con la cámara, o la foto elegida con «Cambiar foto». */
export function ScanPhotoTile({ title, hint, badge, image, onFile, onClear }: {
  title: string;
  hint: string;
  badge: "Recomendada" | "Opcional";
  image: string | null;
  onFile: (f: File) => void;
  /** Web pública: quitar la foto elegida. */
  onClear?: () => void;
}) {
  return (
    <div className="relative">
      <label className="relative block h-[240px] cursor-pointer overflow-hidden rounded-sheet bg-card transition-transform duration-150 active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={image ? `${title} elegida. Pulsa para cambiarla` : `${title}, ${hint}, ${badge}. Pulsa para elegir foto`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
        {image ? (
          <img src={image} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-primary/15 text-primary">
              <Camera className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="type-headline">{title}</span>
            <span className="type-subhead text-muted-foreground">{hint}</span>
          </span>
        )}
        {/* Sobre la foto, cristal oscuro y texto claro; sin foto, la píldora gris del sistema (también en modo claro). */}
        <span className={cn("absolute right-2.5 top-2.5 rounded-full px-[9px] py-1 type-footnote font-semibold",
          image ? "bg-black/45" : "bg-secondary",
          badge === "Recomendada" ? "text-primary" : image ? "text-white/80" : "text-muted-foreground")}>{badge}</span>
        {image && (
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/60 px-3 py-[7px] type-footnote font-semibold backdrop-blur-xl">
            Cambiar foto
          </span>
        )}
      </label>
      {image && onClear && (
        <button
          type="button"
          onClick={() => { void hapticTap(); onClear(); }}
          aria-label={`Quitar ${title.toLowerCase()}`}
          className="absolute left-1 top-1 flex h-11 w-11 items-center justify-center active:opacity-60"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}

/** «Cómo tomar las fotos»: título en Title 3 y una fila por consejo en un grupo sin borde. */
export function ScanTips() {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="type-title3">Cómo tomar las fotos</h3>
      <ul className="overflow-hidden rounded-card bg-card">
        {SCAN_TIPS.map(({ icon: Icon, text }, i) => (
          <li key={text} className={cn("flex min-h-[48px] items-center gap-3 px-4 py-2.5", i > 0 && "sep-t")}>
            <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={2} />
            <span className="type-subhead">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type ObjectivePreset = { id: string; name: string; image_url: string };

/**
 * «Tu físico objetivo»: subir una foto propia o elegir una referencia del admin, en una tira
 * horizontal. Solo con objetivo calcula la IA la similitud y los meses que te faltan.
 */
export function ScanObjectivePicker({ presets, objective, presetId, onPick, onPreset, onClear }: {
  presets: ObjectivePreset[];
  objective: string | null;
  presetId: string | null;
  onPick: (f: File) => void;
  onPreset: (p: ObjectivePreset) => void;
  onClear: () => void;
}) {
  const own = !!objective && !presetId;
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="type-title3">Tu físico objetivo</h3>
          <p className="mt-0.5 type-footnote text-muted-foreground">Elige una referencia o sube tu foto. Solo con objetivo calculamos la similitud y los meses que te faltan.</p>
        </div>
        {objective && (
          <Button variant="plain" size="sm" className="-mr-3 shrink-0" onClick={() => { void hapticTap(); onClear(); }}>Quitar</Button>
        )}
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5" data-no-swipe>
        <label className={cn("relative flex h-28 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-chip bg-card text-center transition-transform duration-150 active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
          own && "ring-2 ring-primary")}>
          {own ? (
            <img src={objective!} alt="Tu objetivo" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span className="type-footnote text-muted-foreground">Subir foto</span>
            </>
          )}
          <input type="file" accept="image/*" className="sr-only" aria-label="Subir la foto de tu físico objetivo"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
        </label>
        {presets.map((p) => {
          const selected = presetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              aria-label={`Objetivo: ${p.name}`}
              onClick={() => { void hapticSelection(); onPreset(p); }}
              className={cn("relative h-28 w-20 shrink-0 overflow-hidden rounded-chip bg-card transition-transform duration-150 active:scale-[0.97]",
                selected && "ring-2 ring-primary")}
            >
              <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1.5 pt-5 text-left">
                <span className="block truncate type-footnote font-semibold text-white">{p.name}</span>
              </span>
              {selected && (
                <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Aviso de error del scan (mensajes de `scanErrors.ts`): en una fila con su icono, nunca el texto del servidor. */
export function ScanErrorNotice({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-card bg-card p-4">
      <IconTile icon={AlertCircle} tone="destructive" />
      <p className="min-w-0 flex-1 self-center type-subhead">{message}</p>
    </div>
  );
}

/** Nota de privacidad con el candado. */
export function ScanPrivacyNote({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 type-footnote text-muted-foreground">
      <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      {keepTogether(text)}
    </p>
  );
}
