import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, FileText, Sparkles, Crown, ChevronLeft } from "lucide-react";
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
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-3 text-4xl font-bold">¿Cómo quieres empezar?</h1>
            <p className="text-lg text-muted-foreground">
              Elige la forma que más te convenga para crear tu plan personalizado
            </p>
          </motion.div>

          {/* Opciones */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Opción 1: Scan con IA */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              onMouseEnter={() => setHoveredOption("scan")}
              onMouseLeave={() => setHoveredOption(null)}
              className="relative"
            >
              <button
                onClick={handleScan}
                className={`group relative w-full overflow-hidden rounded-2xl border-2 p-8 text-left transition-all duration-300 ${
                  hoveredOption === "scan"
                    ? "border-primary bg-primary/5 shadow-lg"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {/* Badge Premium */}
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-3 py-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                  <Crown className="h-3 w-3" />
                  <span>Recomendado</span>
                </div>

                {/* Icono */}
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <Camera className="h-7 w-7" />
                </div>

                {/* Contenido */}
                <h2 className="mb-2 text-2xl font-bold">Análisis con IA</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Toma fotos de tu físico y obtén un análisis completo con IA
                </p>

                {/* Beneficios */}
                <ul className="mb-6 space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                    <span>Plan ultra-personalizado desde el día 1</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                    <span>Pesos estimados según tu masa muscular</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                    <span>Análisis de composición corporal y postura</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                    <span>Insights premium desbloqueados</span>
                  </li>
                </ul>

                <div className="text-sm font-medium text-primary">
                  2-3 minutos →
                </div>
              </button>
            </motion.div>

            {/* Opción 2: Formulario tradicional */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              onMouseEnter={() => setHoveredOption("form")}
              onMouseLeave={() => setHoveredOption(null)}
            >
              <button
                onClick={handleForm}
                className={`group w-full overflow-hidden rounded-2xl border-2 p-8 text-left transition-all duration-300 ${
                  hoveredOption === "form"
                    ? "border-primary bg-primary/5 shadow-lg"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {/* Icono */}
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-foreground transition-transform duration-300 group-hover:scale-110">
                  <FileText className="h-7 w-7" />
                </div>

                {/* Contenido */}
                <h2 className="mb-2 text-2xl font-bold">Formulario clásico</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Responde unas preguntas sobre tu nivel y objetivos
                </p>

                {/* Beneficios */}
                <ul className="mb-6 space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" />
                    <span>Plan personalizado básico</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" />
                    <span>Sin necesidad de fotos</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" />
                    <span>Más rápido de completar</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm opacity-50">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" />
                    <span className="line-through">Pesos personalizados con scan</span>
                  </li>
                </ul>

                <div className="text-sm font-medium text-muted-foreground">
                  1 minuto →
                </div>
              </button>
            </motion.div>
          </div>

          {/* Footer note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Podrás hacer el scan más adelante si eliges el formulario
            </p>
          </motion.div>
        </div>
      </div>
      </div>
    </>
  );
}
