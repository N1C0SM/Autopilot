import { useNavigate, Navigate, Link } from "react-router-dom";
import { ArrowRight, Loader2, Dumbbell, Apple } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Helmet } from "react-helmet-async";
import { hapticTap } from "@/lib/native";

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
      <header className="flex items-center justify-between pt-4 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-[22%] bg-background border border-primary/25 flex items-center justify-center overflow-hidden">
            <svg
              viewBox="0 0 100 100"
              aria-hidden="true"
              className="w-[70%] h-[70%] text-primary"
              fill="none"
            >
              <path d="M14 86 L50 14 L86 86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M56 46 L36 66 L48 66 L44 86 L62 60 L50 60 L55 46 Z" fill="currentColor" />
            </svg>
          </div>
          <span className="font-display font-semibold text-[15px] tracking-tight">
            Autopilot
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-4">
        <h1 className="font-display font-bold tracking-[-0.03em] text-[clamp(2.25rem,9vw,3.25rem)] leading-[1.05]">
          Entreno y nutrición,
          <br />
          <span className="text-primary">en automático.</span>
        </h1>

        <p className="mt-5 text-[15px] text-muted-foreground leading-relaxed max-w-[22rem]">
          Un plan que se construye, se ajusta y avanza contigo cada semana.
          Sin pensar. Sin excusas.
        </p>

        {/* Two cards — same visual language as Nutrición / Progreso in Inicio */}
        <div className="mt-8 grid grid-cols-2 gap-3">
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
        </div>
      </main>

      {/* CTA footer */}
      <footer className="pb-6 pt-4 space-y-2.5">
        <button
          type="button"
          onClick={() => { void hapticTap(); navigate("/signup?free=true"); }}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-[16px] flex items-center justify-center gap-2 transition-transform duration-100 ease-out active:scale-[0.98]"
        >
          Crear cuenta gratis
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { void hapticTap(); navigate("/login"); }}
          className="w-full h-11 rounded-2xl text-foreground/80 font-medium text-[14px] transition-colors active:bg-secondary/40"
        >
          Ya tengo cuenta
        </button>
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
      </footer>
    </div>
  );
};

export default Welcome;
