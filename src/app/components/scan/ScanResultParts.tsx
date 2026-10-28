import { useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { ImageOff } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type IconType = ComponentType<{ className?: string; strokeWidth?: number | string }>;

/** Content image with a composed fallback (grey square + icon) when the URL is missing or fails. */
export function ScanImage({
  src,
  alt,
  className,
  imgClassName,
  style,
}: {
  src: string | null | undefined;
  alt: string;
  /** Size, radius and aspect of the box (applied to the image or to the fallback). */
  className?: string;
  /** Extra classes only for the real image (filters, scale). */
  imgClassName?: string;
  style?: CSSProperties;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return (
      <div role="img" aria-label={alt || undefined} className={cn("flex items-center justify-center bg-secondary", className)}>
        <ImageOff className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.75} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      loading="lazy"
      decoding="async"
      src={src}
      alt={alt}
      style={style}
      onError={() => setFailedSrc(src)}
      className={cn("bg-secondary object-cover", className, imgClassName)}
    />
  );
}

export type Stat = { label: string; value: ReactNode; unit?: string; tone?: string };

/** Health-style stats row: figure + label, separated by hairlines. Four stats wrap to 2 × 2 under 390 px. */
export function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  if (stats.length === 0) return null;
  const four = stats.length === 4;
  const cols = four ? "grid-cols-2 min-[390px]:grid-cols-4" : stats.length === 3 ? "grid-cols-3" : stats.length === 2 ? "grid-cols-2" : "grid-cols-1";
  const cell = (i: number) => {
    if (four) {
      return [
        "pr-3",
        "pl-3 sep-l",
        "pr-3 sep-t min-[390px]:border-t-0 min-[390px]:pl-3 min-[390px]:sep-l",
        "pl-3 sep-l sep-t min-[390px]:border-t-0",
      ][i];
    }
    return i === 0 ? "pr-3" : "pl-3 sep-l";
  };
  return (
    <dl className={cn("grid", cols, className)}>
      {stats.map((s, i) => (
        <div key={s.label} className={cn("flex min-w-0 flex-col-reverse py-2", cell(i))}>
          <dt className="truncate type-footnote text-muted-foreground">{s.label}</dt>
          <dd className="flex flex-wrap items-baseline gap-x-0.5">
            <span className={cn("font-rounded type-title2 font-bold tabular-nums", s.tone)}>{s.value}</span>
            {s.unit ? <span className="type-footnote text-muted-foreground">{s.unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Welcome pattern: 28 px icon on the left, headline + description on the right, optional text action. */
export function FindingRow({
  icon: Icon,
  leading,
  iconClassName = "text-primary",
  title,
  description,
  action,
}: {
  icon?: IconType;
  /** Replaces the icon (a spinner, a ring). */
  leading?: ReactNode;
  iconClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex min-h-8 w-8 shrink-0 items-center justify-center">
        {leading ?? (Icon ? (
          <IconTile
            icon={Icon}
            tone={iconClassName.includes("destructive") ? "destructive" : iconClassName.includes("success") ? "success" : iconClassName.includes("muted") ? "muted" : "primary"}
          />
        ) : null)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="type-headline">{title}</div>
        {description ? <div className="mt-0.5 type-subhead text-muted-foreground">{description}</div> : null}
        {action ? <div className="-ml-3 mt-1">{action}</div> : null}
      </div>
    </div>
  );
}

/** Label + figure + thin bar, on black. `pct` is 0–100. */
export function MeterRow({
  label,
  value,
  hint,
  pct,
  dim,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  pct: number;
  dim?: boolean;
}) {
  const width = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 type-body">{label}</span>
        <span className="shrink-0 font-rounded type-headline font-bold tabular-nums">{value}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", dim ? "bg-primary/50" : "bg-primary")} style={{ width: `${width}%` }} />
      </div>
      {hint ? <div className="mt-1.5 type-footnote text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
