import { useNavigate, Navigate, Link } from "react-router-dom";
import { Loader2, Dumbbell, Apple, Sparkles } from "lucide-react";
import { useAuth } from "@/shared/contexts/AuthContext";
import { Helmet } from "react-helmet-async";
import { hapticTap } from "@/shared/lib/native";

const VoltaMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 100 100"
    aria-hidden="true"
    className={className}
    fill="none"
  >
    <path d="M14 86 L50 14 L86 86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M56 46 L36 66 L48 66 L44 86 L62 60 L50 60 L55 46 Z" fill="currentColor" />
  </svg>
);

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

      {/* Hero — Apple onboarding pattern: app icon + name + large welcome */}
      <main className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-6">
        {/* App icon squircle, exact same silhouette as the iOS icon */}
        <div className="mx-auto w-20 h-20 rounded-[22%] bg-background border border-primary/20 flex items-center justify-center shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.4)]">
          <VoltaMark className="w-[62%] h-[62%] text-primary" />
        </div>

        {/* Welcome lockup — Apple HIG §15 size-specific tracking */}
        <div className="mt-7 text-center">
          <h1 className="type-large-title leading-[1.05] tracking-[-0.035em]">
            Te damos la bienvenida a
            <span className="block mt-1 text-primary">Autopilot</span>
          </h1>
        </div>

        {/* Feature list — Apple pattern: icon left, title + description right */}
        <ul className="mt-10 space-y-6 max-w-sm mx-auto w-full">
          <li className="flex items-start gap-4">
            <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
              <Dumbbell className="w-7 h-7 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="type-headline leading-tight tracking-[-0.015em]">
                Entrenamiento
              </h2>
              <p className="mt-1 type-subhead text-muted-foreground leading-snug">
                Tu rutina se adapta cada semana a lo que haces y a cómo progresas.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
              <Apple className="w-7 h-7 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="type-headline leading-tight tracking-[-0.015em]">
                Nutrición
              </h2>
              <p className="mt-1 type-subhead text-muted-foreground leading-snug">
                Calorías, macros y comidas que encajan con tu objetivo y tu día.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
              <Sparkles className="w-7 h-7 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="type-headline leading-tight tracking-[-0.015em]">
                En automático
              </h2>
              <p className="mt-1 type-subhead text-muted-foreground leading-snug">
                Tu plan se mantiene al día solo. Tú apareces, él se encarga del resto.
              </p>
            </div>
          </li>
        </ul>
      </main>

      {/* CTA footer — Apple onboarding uses a full-width primary + ghost secondary */}
      <footer className="pb-6 pt-4 space-y-3 max-w-sm mx-auto w-full">
        <button
          type="button"
          onClick={() => { void hapticTap(); navigate("/onboarding"); }}
          className="w-full h-[52px] rounded-media bg-primary text-primary-foreground type-body font-semibold tracking-[-0.015em] flex items-center justify-center gap-1.5 transition-transform duration-150 ease-out active:scale-[0.98]"
        >
          Crear mi rutina gratis
        </button>
        <button
          type="button"
          onClick={() => { void hapticTap(); navigate("/login"); }}
          className="w-full h-11 rounded-media text-primary font-medium type-subhead transition-colors active:bg-primary/10"
        >
          Ya tengo cuenta
        </button>
        <p className="type-caption1 text-muted-foreground text-center pt-1.5 leading-relaxed">
          Al continuar aceptas los{" "}
          <Link to="/legal/terminos" className="underline underline-offset-2">
            términos
          </Link>{" "}
          y la{" "}
          <Link to="/legal/privacidad" className="underline underline-offset-2">
            política de privacidad
          </Link>.
        </p>
      </footer>
    </div>
  );
};

export default Welcome;
