import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import PageHead from "@/components/PageHead";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/native";

/**
 * Pantalla de elección ANTES del onboarding
 * El usuario elige entre:
 * 1. Hacer el scan (análisis de físico con IA)
 * 2. Continuar con onboarding tradicional
 */
export default function OnboardingChoice() {
  const navigate = useNavigate();
  const [hoveredOption, setHoveredOption] = useState<"scan" | "form" | null>(null);

  const handleScan = () => {
    void hapticTap();
    track("onboarding_choice_selected", { choice: "scan" });
    // Redirigir al scan
    navigate("/scan");
  };

  const handleForm = () => {
    void hapticTap();
    track("onboarding_choice_selected", { choice: "form" });
    // Redirigir al onboarding tradicional
    navigate("/onboarding");
  };

  const goBack = () => {
    void hapticTap();
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <>
      <PageHead
        title="Elige cómo empezar"
        description="Análisis con IA o formulario tradicional"
        path="/onboarding-choice"
      />
      
      <div className="flex min-h-screen flex-col">
        <header className="app-chrome pt-safe">
          <div className="container mx-auto flex h-14 max-w-2xl items-center px-4">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-11 items-center gap-0.5 pl-0.5 pr-2 text-primary transition-opacity active:opacity-60"
            >
              <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden="true" />
              <span className="type-body">Atrás</span>
            </button>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-6">
        <div className="w-full max-w-md md:max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Paso 1 · Empezar</p>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">¿Cómo creamos tu plan?</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Las dos opciones terminan en tu rutina. Elige la que te resulte más cómoda.
            </p>
          </motion.div>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {([
              {
                key: "form" as const,
                onClick: handleForm,
                icon: FileText,
                title: "Responder preguntas",
                desc: "Objetivo, días disponibles y comidas.",
                time: "≈ 1 min",
                points: ["Sin fotos", "Lo más rápido"],
                badge: "Recomendado",
              },
              {
                key: "scan" as const,
                onClick: handleScan,
                icon: Camera,
                title: "Escanear mi físico",
                desc: "Sube fotos y la IA estima tu punto de partida.",
                time: "≈ 3 min",
                points: ["Estimación orientativa", "Necesita fotos"],
                badge: null,
              },
            ]).map((o, i) => {
              const Icon = o.icon;
              const active = hoveredOption === o.key;
              return (
                <motion.button
                  key={o.key}
                  type="button"
                  onClick={o.onClick}
                  onMouseEnter={() => setHoveredOption(o.key)}
                  onMouseLeave={() => setHoveredOption(null)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08 + i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{o.title}</h2>
                      {o.badge && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                          {o.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{o.desc}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-primary/40 px-2.5 py-0.5 text-xs font-medium text-primary">{o.time}</span>
                      {o.points.map((p) => (
                        <span key={p} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">{p}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </motion.button>
              );
            })}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Puedes hacer el scan más adelante desde tu panel.
          </p>
        </div>
      </div>
      </div>
    </>
  );
}
