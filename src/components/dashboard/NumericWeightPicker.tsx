import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/native";

interface NumericWeightPickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  label?: string;
}

/**
 * Numeric wheel picker for weight input (Apple Fitness+ style).
 * Vertical scroll to change weight value.
 */
const NumericWeightPicker = ({
  value,
  onChange,
  min = 0,
  max = 200,
  step = 2.5,
  className,
  label = "Peso (kg)",
}: NumericWeightPickerProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const currentValue = useRef<number>(parseFloat(value) || 0);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = (num: number, min: number, max: number) =>
    Math.min(Math.max(num, min), max);

  const handleDown = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    startY.current = "touches" in e ? e.touches[0].clientY : e.clientY;
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    const currentY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const delta = startY.current - currentY;
    
    // Sensitivity: move 50px = change 5kg
    const change = (delta / 50) * 5;
    currentValue.current = clamp(currentValue.current + change, min, max);
    
    // Round to step
    const rounded = Math.round(currentValue.current / step) * step;
    const formatted = rounded.toString();
    
    setDisplayValue(formatted);
    onChange(formatted);
  };

  const handleUp = () => {
    if (isDragging) {
      setIsDragging(false);
      void hapticTap();
    }
  };

  // Keyboard controls
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const newVal = clamp(currentValue.current + step, min, max);
      currentValue.current = newVal;
      const formatted = Math.round(newVal / step) * step;
      setDisplayValue(formatted.toString());
      onChange(formatted.toString());
      void hapticTap();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newVal = clamp(currentValue.current - step, min, max);
      currentValue.current = newVal;
      const formatted = Math.round(newVal / step) * step;
      setDisplayValue(formatted.toString());
      onChange(formatted.toString());
      void hapticTap();
    }
  };

  useEffect(() => {
    setDisplayValue(value);
    currentValue.current = parseFloat(value) || 0;
  }, [value]);

  return (
    <div className={cn("relative select-none", className)} ref={containerRef}>
      <label className="block type-subhead text-muted-foreground mb-3">
        {label}
      </label>
      
      <div
        className="group relative h-48 w-full cursor-ns-resize rounded-2xl bg-card border border-border p-4 flex items-center justify-center overflow-hidden touch-pan-y"
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label={label}
        aria-valuenow={parseFloat(displayValue) || 0}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Current value */}
        <div className="relative z-10 text-center">
          <motion.div
            animate={{
              scale: isDragging ? 1.1 : 1,
              opacity: isDragging ? 0.8 : 1,
            }}
            className="flex flex-col items-center"
          >
            <span className="type-title1 font-bold tabular-nums tracking-tighter text-foreground">
              {displayValue}
            </span>
            <span className="type-footnote text-muted-foreground mt-1">kg</span>
          </motion.div>
        </div>

        {/* Visual drag indicators */}
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-1 opacity-30">
          <ChevronUp className="h-6 w-6 text-foreground" />
          <ChevronUp className="h-6 w-6 text-foreground" />
          <ChevronUp className="h-6 w-6 text-foreground" />
        </div>
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1 opacity-30">
          <ChevronDown className="h-6 w-6 text-foreground" />
          <ChevronDown className="h-6 w-6 text-foreground" />
          <ChevronDown className="h-6 w-6 text-foreground" />
        </div>

        {/* Drag hint */}
        {!isDragging && (
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <span className="type-footnote text-muted-foreground/60">
              Desliza para cambiar
            </span>
          </div>
        )}
      </div>

      {/* Quick buttons */}
      <div className="mt-4 flex gap-2">
        {[min, max / 2, max].map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => {
              const formatted = Math.round(val / step) * step;
              setDisplayValue(formatted.toString());
              onChange(formatted.toString());
              void hapticTap();
            }}
            className="flex-1 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium active:bg-accent transition-colors"
          >
            {val === min ? "0" : val === max / 2 ? `${val}` : `${max}`}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NumericWeightPicker;
