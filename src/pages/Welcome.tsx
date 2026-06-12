import { motion } from "framer-motion";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { ArrowRight, Loader2, Dumbbell, Apple, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Helmet } from "react-helmet-async";

const Welcome = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div
      className="relative min-h-screen bg-background text-foreground overflow-hidden flex flex-col"
      style={{
        paddingTop: "var(--safe-top, 0px)",
        paddingBottom: "var(--safe-bottom, 0px)",
      }}
    >
      <Helmet>
        <title>Autopilot</title>
      </Helmet>

      {/* Halo animado superior */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute -top-[20%] left-1/2 -translate-x-1/2 w-[140%] h-[80%]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, hsl(var(--primary) / 0.35), transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      {/* Glow inferior sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[-30%] h-[60%]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 70%, hsl(var(--primary) / 0.10), transparent 70%)",
        }}
      />
      {/* Grid pattern sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 70% 50% at 50% 40%, black 30%, transparent 80%)",
        }}
      />

      {/* Contenido scroll-safe */}
      <div className="relative z-10 flex-1 flex flex-col px-6 pt-8">
        {/* Header con wordmark + pill */}
        <motion.div {...fade(0)} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center overflow-hidden">
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.6), transparent 60%)",
                }}
              />
              <span className="relative font-display font-black text-primary text-sm">
                A
              </span>
            </div>
            <span className="font-display font-bold text-[15px] tracking-tight">
              Autopilot
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 h-7 rounded-full border border-border/60 bg-card/40 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/70" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span className="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
              En piloto automático
            </span>
          </div>
        </motion.div>

        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full -mt-2">
          <motion.div
            {...fade(0.05)}
            className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-5"
          >
            01 — Bienvenido
          </motion.div>

          <motion.h1
            {...fade(0.1)}
            className="font-display font-bold tracking-[-0.03em] text-[clamp(2.5rem,10.5vw,3.75rem)] leading-[0.98]"
          >
            Entreno
            <br />
            <span className="italic font-medium text-muted-foreground">y</span>{" "}
            nutrición,
            <br />
            <span className="text-gradient">en automático.</span>
          </motion.h1>

          <motion.p
            {...fade(0.2)}
            className="mt-6 text-[15px] text-muted-foreground leading-relaxed max-w-[20rem]"
          >
            Un plan que se construye, se ajusta y avanza contigo cada semana.
            Sin pensar. Sin excusas.
          </motion.p>

          {/* Mini features */}
          <motion.div
            {...fade(0.3)}
            className="mt-7 grid grid-cols-2 gap-2.5"
          >
            <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-3.5 flex flex-col gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Dumbbell className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <div className="text-[13px] font-semibold leading-tight">
                  Entrenamiento
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  Adaptado cada semana
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-3.5 flex flex-col gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Apple className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <div className="text-[13px] font-semibold leading-tight">
                  Nutrición
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  Calorías y macros listos
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* CTA sticky abajo */}
      <motion.div
        {...fade(0.28)}
        className="relative z-10 px-6 pb-5 pt-4 space-y-3"
      >
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => navigate("/signup")}
          className="group relative w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.6)] overflow-hidden"
        >
          <span className="relative z-10">Empezar 7 días gratis</span>
          <ArrowRight className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          <span
            aria-hidden
            className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)",
            }}
          />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => navigate("/login")}
          className="w-full h-12 rounded-2xl text-foreground/90 font-medium text-[14px] hover:bg-card/40 transition-colors"
        >
          Ya tengo cuenta
        </motion.button>
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="w-3 h-3 text-muted-foreground" />
          <p className="text-[10.5px] text-muted-foreground text-center leading-relaxed">
            Cancela cuando quieras · Acepta{" "}
            <Link to="/legal/terminos" className="underline underline-offset-2">
              términos
            </Link>{" "}
            y{" "}
            <Link to="/legal/privacidad" className="underline underline-offset-2">
              privacidad
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Welcome;