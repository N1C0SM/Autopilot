import { useNavigate, Navigate, Link } from "react-router-dom";
import { Loader2, Zap, Utensils, BarChart3, ArrowRight } from "lucide-react";
import { useAuth } from "@/shared/contexts/AuthContext";
import { Helmet } from "react-helmet-async";
import { hapticTap } from "@/shared/lib/native";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

/**
 * Bienvenida — identidad unificada con la landing:
 * foto a sangre + gradiente izquierda, titular bold, features con icono, pills.
 */
const Welcome = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  const features = [
    { icon: Zap,      t: "Plan personalizado",  s: "Tu rutina se adapta cada semana según tu progreso real." },
    { icon: Utensils, t: "Nutrición adaptada",   s: "Macros y comidas del día ajustados a tu objetivo." },
    { icon: BarChart3, t: "Progreso real",        s: "Récords, volumen y evolución siempre a la vista." },
  ];

  return (
    <div
      className="relative flex min-h-screen flex-col bg-background text-foreground"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <Helmet><title>Autopilot</title></Helmet>

      {/* Foto a sangre — igual que LandingHero */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={BRAND_PHOTOS.gym}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-[65%_20%] opacity-55"
        />
        {/* Gradiente izq→der como la landing */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
        {/* Gradiente bottom para los botones */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      {/* Contenido */}
      <main className="relative flex flex-1 flex-col justify-end px-6 pb-4">
        {/* Kicker — idéntico a la landing */}
        <p className="kicker mb-4">Entrenamiento · Nutrición · Progreso</p>

        {/* Titular — mismo peso y tracking que la landing */}
        <h1 className="text-[38px] font-bold leading-[1.05] tracking-[-0.025em]">
          Convierte la disciplina<br />
          <span className="text-primary">en resultados.</span>
        </h1>

        <p className="mt-4 max-w-[340px] text-[17px] leading-[24px] text-foreground/85">
          Tu sistema de entrenamiento, nutrición y progreso.<br />Simple, personal y basado en datos.
        </p>

        {/* Features — mismo patrón que los 4 pillars de la landing */}
        <ul className="mt-8 grid grid-cols-1 gap-4">
          {features.map(({ icon: I, t, s }) => (
            <li key={t} className="flex items-center gap-4">
              <I className="h-6 w-6 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <div className="text-[14px] leading-[19px]">
                <p className="font-semibold">{t}</p>
                <p className="text-foreground/75">{s}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* CTAs — h-12 rounded-full igual que la landing */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => { void hapticTap(); navigate("/onboarding"); }}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-semibold text-primary-foreground transition-opacity active:opacity-80"
          >
            Empezar gratis <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { void hapticTap(); navigate("/login"); }}
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-foreground/35 text-[16px] font-semibold text-foreground transition-colors hover:bg-foreground/5 active:opacity-75"
          >
            Ya tengo cuenta
          </button>
        </div>

        {/* Legal */}
        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Al continuar aceptas los{" "}
          <Link to="/legal/terminos" className="text-primary underline-offset-2 hover:underline">términos</Link>
          {" "}y la{" "}
          <Link to="/legal/privacidad" className="text-primary underline-offset-2 hover:underline">privacidad</Link>.
        </p>
      </main>
    </div>
  );
};

export default Welcome;
