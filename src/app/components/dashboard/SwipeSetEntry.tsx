import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { hapticTap, isNative } from "@/shared/lib/native";

interface SwipeSetEntryProps {
  initialWeight?: string;
  onSwipeComplete: (weight: string, reps: number) => void;
  onCancel?: () => void;
  reps: number;
  className?: string;
}

/**
 * Swipe-to-record entry inspired by Setgraph iOS.
 * User swipes up to record a set with pre-filled weight and target reps.
 */
const SwipeSetEntry = ({
  initialWeight = "",
  onSwipeComplete,
  onCancel,
  reps,
  className,
}: SwipeSetEntryProps) => {
  const [weight, setWeight] = useState(initialWeight);
  const [swiping, setSwiping] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [hasAttemptedSwipe, setHasAttemptedSwipe] = useState(false);

  const y = useMotionValue(0);
  const rotate = useTransform(y, [-100, 100], [-10, 10]);
  const scale = useTransform(y, [-50, 150], [1, 1.1]);
  const opacity = useTransform(y, [0, 120], [1, 0]);
  const bgOpacity = useTransform(y, [80, 120], [0, 1]);

  const containerRef = useRef<HTMLDivElement>(null);
  const isIOS = isNative() && /iPhone|iPad|iPod/.test(navigator.userAgent);

  // Handle touch/mouse events for swipe
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let startY = 0;
    let isSwiping = false;

    const handleStart = (e: TouchEvent | MouseEvent) => {
      if (recorded || !isIOS) return;
      startY = "touches" in e ? e.touches[0].clientY : e.clientY;
      isSwiping = true;
      setHasAttemptedSwipe(true);
    };

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!isSwiping || !isIOS) return;
      const currentY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const delta = currentY - startY;
      
      if (delta > 0) {
        setSwiping(true);
        y.set(delta);
        setSwipeProgress(Math.min(delta / 120, 1));
      }
    };

    const handleEnd = () => {
      if (!isSwiping || !isIOS) return;
      isSwiping = false;
      
      if (swipeProgress >= 0.9) {
        // Swipe completed - record the set
        if (weight) {
          setRecorded(true);
          setTimeout(() => {
            onSwipeComplete(weight, reps);
          }, 300);
        }
      } else {
        // Reset
        y.set(0);
        setSwipeProgress(0);
        setSwiping(false);
      }
    };

    container.addEventListener("mousedown", handleStart);
    container.addEventListener("touchstart", handleStart, { passive: false });
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchend", handleEnd);

    return () => {
      container.removeEventListener("mousedown", handleStart);
      container.removeEventListener("touchstart", handleStart);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [y, swipeProgress, recorded, weight, reps, onSwipeComplete, isIOS]);

  // Keyboard support for non-touch devices
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (weight) {
        onSwipeComplete(weight, reps);
      }
    }
  };

  return (
    <div className={cn("relative select-none", className)}>
      {/* Input field for weight */}
      <div className="relative z-10">
        <label className="block type-subhead text-muted-foreground mb-2">
          Peso (kg)
        </label>
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Ej: 80"
          className="w-full h-14 rounded-media bg-card px-4 type-title3 font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          autoFocus
          inputMode="numeric"
          aria-label="Peso en kg"
        />
        {initialWeight && (
          <button
            type="button"
            onClick={() => {
              setWeight(initialWeight);
              void hapticTap();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/60 hover:text-primary transition-colors"
            aria-label="Usar peso anterior"
          >
            ←
          </button>
        )}
      </div>

      {/* Swipe zone hint */}
      {!recorded && (
        <div className="mt-6 text-center">
          <p className="type-footnote text-muted-foreground mb-4">
            {isIOS ? "Desliza hacia arriba para guardar" : "Presiona Enter para guardar"}
          </p>
        </div>
      )}

      {/* Swipe indicator (iOS only) */}
      {isIOS && swiping && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <motion.div
            style={{ y, rotate, scale, opacity }}
            className="absolute top-0 left-0 right-0 h-full flex flex-col items-center justify-center gap-3"
          >
            <div
              className={cn(
                "h-32 w-32 rounded-full flex items-center justify-center transition-colors duration-300",
                swipeProgress < 0.8
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary text-primary-foreground"
              )}
            >
              <motion.div style={{ opacity: bgOpacity }}>
                <Check className="h-12 w-12" strokeWidth={3} />
              </motion.div>
            </div>
            <span className="type-headline font-semibold text-foreground">
              Guardar serie
            </span>
          </motion.div>
        </div>
      )}

      {/* Recorded state */}
      {recorded && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-4"
        >
          <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="h-8 w-8 text-success" strokeWidth={3} />
          </div>
          <span className="type-headline font-semibold text-success">
            Serie guardada
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default SwipeSetEntry;
