import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  // `hover:` only applies on devices that can actually hover. On a touch screen a
  // hover style sticks after the tap, which is the clearest "this is a web page" tell.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Tailwind's `text-sm`, `text-base`… siguen Dynamic Type igual que las
      // clases `type-*`: solo cambia el tamaño del texto, nunca la rejilla. Con
      // `--type-scale: 1` los valores son idénticos a los de Tailwind.
      fontSize: {
        xs: [`calc(0.75rem * var(--type-scale))`, { lineHeight: "calc(1rem * var(--type-scale))" }],
        sm: [`calc(0.875rem * var(--type-scale))`, { lineHeight: "calc(1.25rem * var(--type-scale))" }],
        base: [`calc(1rem * var(--type-scale))`, { lineHeight: "calc(1.5rem * var(--type-scale))" }],
        lg: [`calc(1.125rem * var(--type-scale))`, { lineHeight: "calc(1.75rem * var(--type-scale))" }],
        xl: [`calc(1.25rem * var(--type-scale))`, { lineHeight: "calc(1.75rem * var(--type-scale))" }],
        "2xl": [`calc(1.5rem * var(--type-scale))`, { lineHeight: "calc(2rem * var(--type-scale))" }],
        "3xl": [`calc(1.875rem * var(--type-scale))`, { lineHeight: "calc(2.25rem * var(--type-scale))" }],
        "4xl": [`calc(2.25rem * var(--type-scale))`, { lineHeight: "calc(2.5rem * var(--type-scale))" }],
        "5xl": [`calc(3rem * var(--type-scale))`, { lineHeight: "1" }],
        "6xl": [`calc(3.75rem * var(--type-scale))`, { lineHeight: "1" }],
        "7xl": [`calc(4.5rem * var(--type-scale))`, { lineHeight: "1" }],
        "8xl": [`calc(6rem * var(--type-scale))`, { lineHeight: "1" }],
        "9xl": [`calc(8rem * var(--type-scale))`, { lineHeight: "1" }],
      },
      // The platform's system font everywhere: San Francisco on Apple devices, with its
      // own optical sizing and tracking. The stacks live in index.css as CSS variables.
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        body: ["var(--font-body)"],
        rounded: ["var(--font-rounded)"],
        mono: ["ui-monospace", "SF Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // UIKit's own curves: `ios` is the sheet / push / spring-settle curve,
      // `ios-standard` the default ease-in-out used for fades and small moves.
      transitionTimingFunction: {
        ios: "cubic-bezier(0.32, 0.72, 0, 1)",
        "ios-standard": "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(48 100% 50% / 0.15)" },
          "50%": { boxShadow: "0 0 40px hsl(48 100% 50% / 0.3)" },
        },
        // UIActivityIndicatorView: each blade fades from full to faint in turn.
        "ios-spinner": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0.15" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        // Starts where the finger left the sheet when it is dragged to dismiss.
        "sheet-down": {
          from: { transform: "translateY(var(--sheet-offset, 0px))" },
          to: { transform: "translateY(100%)" },
        },
        // UIAlertController settles in from slightly larger.
        "alert-in": {
          from: { opacity: "0", transform: "scale(1.12)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "alert-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "ios-spinner": "ios-spinner 0.8s linear infinite",
        "sheet-up": "sheet-up 0.42s cubic-bezier(0.32, 0.72, 0, 1) backwards",
        "sheet-down": "sheet-down 0.3s cubic-bezier(0.32, 0.72, 0, 1) both",
        "alert-in": "alert-in 0.24s cubic-bezier(0.32, 0.72, 0, 1) both",
        "alert-out": "alert-out 0.16s ease-out both",
      },
    },
  },
  plugins: [animate, typography],
} satisfies Config;
