import { Check } from "lucide-react";
import { hapticSelection } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

/** Chips de selección múltiple (tipo checkbox), en píldora: dorado suave si está marcado. */
export function ChipGroup({ header, options, isOn, onToggle }: {
  header?: string;
  options: readonly string[];
  isOn: (v: string) => boolean;
  onToggle: (v: string) => void;
}) {
  return (
    <section>
      {header && <p className="mb-3 px-1 type-footnote font-semibold uppercase tracking-wide text-muted-foreground">{header}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = isOn(o);
          return (
            <button
              key={o}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => { void hapticSelection(); onToggle(o); }}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-full px-4 type-subhead font-medium transition-colors active:scale-[0.97]",
                on ? "bg-primary/15 text-primary" : "bg-card text-foreground",
              )}
            >
              {on && <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
              {o}
            </button>
          );
        })}
      </div>
    </section>
  );
}
