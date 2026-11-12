import { useNavigate, Navigate, Link } from "react-router-dom";
import { ArrowRight, Dumbbell, Loader2, Sparkles, Utensils } from "lucide-react";
import { useAuth } from "@/shared/contexts/AuthContext";
import { Helmet } from "react-helmet-async";
import { hapticTap } from "@/shared/lib/native";
import { BRAND_PHOTOS, useBrandPhotos } from "@/shared/lib/brandPhotos";
import { AppIconMark } from "@/shared/components/ui/app-icon-mark";

const Welcome = () => {
  useBrandPhotos(); // repinta las fotos de marca cuando llega su URL actual
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
    { icon: Dumbbell, text: "Rutina adaptativa que sube las cargas cada semana" },
    { icon: Utensils, text: "Nutrición: macros y comidas del día" },
    { icon: Sparkles, text: "Todo en automático, tú solo apareces" },
  ];

  return (
    <div
      className="relative flex min-h-screen flex-col bg-background text-foreground"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <Helmet><title>Autopilot</title></Helmet>

      <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-black">
        <img
          src={BRAND_PHOTOS.gym}
          alt=""
          className="h-full w-full object-cover object-[50%_25%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black" />
        <div className="absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-black via-black/85 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(212,175,55,0.08),transparent_60%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-end px-6 pb-4">
        <div className="mb-5 flex items-center gap-3.5">
          <AppIconMark size={52} />
          <div>
            <p className="text-[13px] font-black tracking-[0.18em] text-white">AUTOPILOT</p>
            <p className="mt-0.5 text-[13px] font-medium text-white/50">Entrenamiento adaptativo</p>
          </div>
        </div>

        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.025em] text-white">
          Tu entrenamiento,<br />
          <span>en piloto automático.</span>
        </h1>

        <ul className="mt-[18px] grid grid-cols-1 gap-[10px] pb-8">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex min-h-7 items-center gap-3">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
              </span>
              <p className="line-clamp-2 text-[14px] leading-[19px] text-white/70">{text}</p>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-[10px]">
          <button
            type="button"
            onClick={() => { void hapticTap(); navigate("/onboarding"); }}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-semibold text-primary-foreground transition-opacity active:opacity-80"
          >
            Crear mi rutina gratis <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { void hapticTap(); navigate("/login"); }}
            className="inline-flex h-11 w-full items-center justify-center rounded-full text-[14px] font-semibold text-primary transition-opacity active:opacity-75"
          >
            Ya tengo cuenta
          </button>
        </div>

        <p className="mt-2 text-center text-[12px] leading-[18px] text-white/30">
          Al continuar aceptas los{" "}
          <Link to="/legal/terminos" className="text-white/50 underline-offset-2 hover:underline">términos</Link>
          {" "}y la{" "}
          <Link to="/legal/privacidad" className="text-white/50 underline-offset-2 hover:underline">política de privacidad</Link>.
        </p>
      </main>
    </div>
  );
};

export default Welcome;
