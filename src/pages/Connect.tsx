import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ExternalLink, Sparkles } from "lucide-react";

const mcpUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

const Connect = () => {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      toast.success("URL copiada");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Conectar Autopilot a tu asistente · MCP</title>
        <meta
          name="description"
          content="Conecta Autopilot a ChatGPT o Claude en menos de un minuto para consultar tu plan de entrenamiento y nutrición desde tu asistente favorito."
        />
        <link rel="canonical" href="https://autopilotplan.com/connect" />
      </Helmet>

      <div className="container mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.08] mb-6">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Integración con IA
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold font-display leading-[1.05] tracking-tight mb-4">
          Conecta Autopilot a tu <span className="text-gradient">asistente de IA</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground mb-10 max-w-xl leading-relaxed">
          En un minuto tendrás tu plan de entrenamiento, tu nutrición y tus registros de peso disponibles desde ChatGPT o Claude. Solo hace falta pegar esta URL.
        </p>

        {/* URL card */}
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-12 premium-shadow">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-3">
            URL del servidor MCP
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 min-w-0 rounded-xl bg-muted px-4 py-3 text-sm font-mono break-all">
              {mcpUrl}
            </code>
            <Button onClick={copyUrl} variant="hero" className="shrink-0">
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copiada
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar
                </>
              )}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Cuando tu asistente te pida iniciar sesión, entra con tu cuenta de Autopilot: verá solo tus propios datos.
          </p>
        </section>

        {/* ChatGPT */}
        <section className="mb-10">
          <h2 className="text-xl sm:text-2xl font-bold font-display mb-4">
            Conectar desde ChatGPT
          </h2>
          <ol className="space-y-3">
            {[
              <>
                Abre{" "}
                <a
                  href="https://chatgpt.com/#settings/Connectors/Advanced"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Ajustes → Conectores → Avanzado
                  <ExternalLink className="w-3 h-3" />
                </a>{" "}
                y activa <strong>Developer mode</strong> (revisa el aviso de riesgo que aparece).
              </>,
              <>En el chat, abre el menú "+" del composer y activa <strong>Developer mode</strong>.</>,
              <>Pulsa <strong>Add sources</strong> y luego <strong>Connect more</strong>.</>,
              <>Ponle un nombre al conector (por ejemplo "Autopilot") y pega la URL de arriba.</>,
              <>Pide a ChatGPT que use Autopilot: por ejemplo, "enséñame mi plan de entrenamiento".</>,
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-card/50 p-4"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground/90">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Claude */}
        <section className="mb-14">
          <h2 className="text-xl sm:text-2xl font-bold font-display mb-4">
            Conectar desde Claude
          </h2>
          <ol className="space-y-3">
            {[
              <>
                Abre{" "}
                <a
                  href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Añadir conector personalizado en Claude
                  <ExternalLink className="w-3 h-3" />
                </a>
                .
              </>,
              <>Ponle nombre al conector (por ejemplo "Autopilot") y pega la URL de arriba.</>,
              <>Actívalo desde el composer del chat y pídele a Claude que use Autopilot.</>,
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-card/50 p-4"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground/90">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="rounded-2xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
          <strong className="text-foreground">¿Problemas?</strong> Asegúrate de estar en la cuenta correcta de Autopilot al iniciar sesión durante la conexión. Tu asistente solo podrá leer tu perfil, tu plan y registrar tu peso — nunca datos de otros usuarios.
        </div>
      </div>
    </div>
  );
};

export default Connect;