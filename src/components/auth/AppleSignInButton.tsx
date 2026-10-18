import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/native";

type AppleSignInButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: "sign-in" | "sign-up" | "continue";
};

const LABELS: Record<NonNullable<AppleSignInButtonProps["label"]>, string> = {
  "sign-in": "Iniciar sesión con Apple",
  "sign-up": "Registrarse con Apple",
  continue: "Continuar con Apple",
};

const AppleLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 384 512" aria-hidden="true" className={className} fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

export const AppleSignInButton = forwardRef<HTMLButtonElement, AppleSignInButtonProps>(
  ({ label = "continue", className, children, onClick, ...props }, ref) => {
    const text = children ?? LABELS[label];
    return (
      <button
        ref={ref}
        type="button"
        {...props}
        onClick={(event) => {
          void hapticTap();
          onClick?.(event);
        }}
        // Same metrics as the gold CTA (`btn-lg`: 50 pt, radius 14, 17 pt) so both stack as equals (HIG).
        className={cn(
          "btn-lg inline-flex w-full items-center justify-center gap-2",
          "bg-white text-black",
          "font-semibold",
          "transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] active:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        <AppleLogo className="w-[18px] h-[18px] -mt-0.5" />
        <span>{text}</span>
      </button>
    );
  },
);

AppleSignInButton.displayName = "AppleSignInButton";
