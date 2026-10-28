import { Minus, Plus } from "lucide-react";
import { hapticSelection } from "@/shared/lib/native";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Botones de ajuste rápido de peso: +/-1kg, +/-2.5kg, +/-5kg.
 * Diseñados para uso con una sola mano y dedos fatigados en el gimnasio.
 */
export function WeightAdjuster({ value, onChange, disabled }: Props) {
  const adjust = (delta: number) => {
    if (disabled) return;
    void hapticSelection();
    const current = parseFloat(value) || 0;
    const next = Math.max(0, current + delta);
    onChange(String(next));
  };

  return (
    <div className="flex items-center gap-1">
      {/* Decrementos */}
      <button
        type="button"
        onClick={() => adjust(-5)}
        disabled={disabled}
        className="flex h-8 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors active:bg-accent disabled:opacity-40 [touch-action:manipulation]"
        aria-label="Restar 5 kg"
      >
        <span className="type-caption2 font-semibold tabular-nums">-5</span>
      </button>
      <button
        type="button"
        onClick={() => adjust(-2.5)}
        disabled={disabled}
        className="flex h-8 w-12 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors active:bg-accent disabled:opacity-40 [touch-action:manipulation]"
        aria-label="Restar 2.5 kg"
      >
        <span className="type-caption2 font-semibold tabular-nums">-2.5</span>
      </button>
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={disabled}
        className="flex h-8 w-10 items-center justify-center rounded-lg bg-secondary text-foreground transition-colors active:bg-accent disabled:opacity-40 [touch-action:manipulation]"
        aria-label="Restar 1 kg"
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>

      {/* Incrementos */}
      <button
        type="button"
        onClick={() => adjust(1)}
        disabled={disabled}
        className="flex h-8 w-10 items-center justify-center rounded-lg bg-secondary text-foreground transition-colors active:bg-accent disabled:opacity-40 [touch-action:manipulation]"
        aria-label="Sumar 1 kg"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => adjust(2.5)}
        disabled={disabled}
        className="flex h-8 w-12 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors active:bg-accent disabled:opacity-40 [touch-action:manipulation]"
        aria-label="Sumar 2.5 kg"
      >
        <span className="type-caption2 font-semibold tabular-nums">+2.5</span>
      </button>
      <button
        type="button"
        onClick={() => adjust(5)}
        disabled={disabled}
        className="flex h-8 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors active:bg-accent disabled:opacity-40 [touch-action:manipulation]"
        aria-label="Sumar 5 kg"
      >
        <span className="type-caption2 font-semibold tabular-nums">+5</span>
      </button>
    </div>
  );
}
