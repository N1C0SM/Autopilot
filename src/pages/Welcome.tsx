import { motion } from "framer-motion";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { ArrowRight, Loader2, Dumbbell, Apple } from "lucide-react";
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
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col px-6"
      style={{
        paddingTop: "var(--safe-top, 0px)",
        paddingBottom: "var(--safe-bottom, 0px)",
      }}
    >
      <Helmet>
        <title>Autopilot</title>
      </Helmet>

      {/* Top bar — same visual language as Inicio */}
      <motion.header
        {...fade(0)}
        className="flex items-center justify-between pt-4 pb-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
            <span className="font-display font-bold text-primary text-sm">A</span>
          </div>
          <span className="font-display font-semibold text-[15px] tracking-tight">
            Autopilot
          </span>
        </div>
      </motion.header>

      {/* Hero */}
      <main className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-4">
        <motion.h1
          {...fade(0.05)}
          className="font-display font-bold tracking-[-0.03em] text-[clamp(2.25rem,9vw,3.25rem)] leading-[1.05]"
        >
          Entreno y nutrición,
          <br />
          <span className="text-primary">en automático.</span>
        </motion.h1>

        <motion.p
          {...fade(0.15)}
          className="mt-5 text-[15px] text-muted-foreground leading-relaxed max-w-[22rem]"
        >
          Un plan que se construye, se ajusta y avanza contigo cada semana.
          Sin pensar. Sin excusas.
        </motion.p>

        {/* Two cards — same visual language as Nutrición / Progreso in Inicio */}
        <motion.div
          {...fade(0.25)}
          className="mt-8 grid grid-cols-2 gap-3"
        >
          <div className="rounded-2xl bg-secondary p-4 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-[15px] font-semibold leading-tight">
                Entrenamiento
              </div>
              <div className="text-[12px] text-muted-foreground leading-tight mt-1">
                Adaptado cada semana
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-secondary p-4 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Apple className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-[15px] font-semibold leading-tight">
                Nutrición
              </div>
              <div className="text-[12px] text-muted-foreground leading-tight mt-1">
                Calorías y macros listos
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* CTA footer */}
      <motion.footer
        {...fade(0.35)}
        className="pb-6 pt-4 space-y-2.5"
      >
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => navigate("/signup?free=true")}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-[16px] flex items-center justify-center gap-2"
        >
          Crear cuenta gratis
          <ArrowRight className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => navigate("/login")}
          className="w-full h-11 rounded-2xl text-foreground/80 font-medium text-[14px]"
        >
          Ya tengo cuenta
        </motion.button>
        <p className="text-[11px] text-muted-foreground text-center pt-2 leading-relaxed">
          Plan gratis sin tarjeta · Acepta{" "}
          <Link to="/legal/terminos" className="underline underline-offset-2">
            términos
          </Link>{" "}
          y{" "}
          <Link to="/legal/privacidad" className="underline underline-offset-2">
            privacidad
          </Link>
        </p>
      </motion.footer>
    </div>
  );
};

export default Welcome;
