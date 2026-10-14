import { useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ListGroup } from "@/components/ui/list";
import Screen from "@/components/native/Screen";
import { toast } from "sonner";
import { hapticNotify } from "@/lib/native";

const mcpUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

const linkClass = "text-primary transition-opacity active:opacity-60";

const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol>
    {items.map((step, i) => (
      <li key={i} className="group/row flex items-start gap-3 px-4">
        <span className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 type-footnote font-semibold tabular-nums text-primary">
          {i + 1}
        </span>
        <span className="min-w-0 flex-1 py-3 type-subhead group-[:not(:last-child)]/row:sep-b">{step}</span>
      </li>
    ))}
  </ol>
);

const Connect = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      void hapticNotify("success");
      toast.success("URL copiada");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      void hapticNotify("error");
      toast.error("No se pudo copiar");
    }
  };

  return (
    <>
      <Helmet>
        <title>Conectar Autopilot con ChatGPT o Claude (MCP) · Autopilot</title>
        <meta
          name="description"
          content="Conecta Autopilot a ChatGPT o Claude en menos de un minuto para consultar tu plan de entrenamiento y nutrición desde tu asistente favorito."
        />
        <link rel="canonical" href="https://autopilotplan.com/connect" />
      </Helmet>

      <Screen title="Conectar con IA" largeTitle onBack={() => navigate("/")} backLabel="Inicio" maxWidth="md">
        <div className="space-y-8 pb-6">
          <p className="px-1 type-callout text-muted-foreground">
            En un minuto tendrás tu plan de entrenamiento, tu nutrición y tus registros de peso disponibles desde ChatGPT o Claude. Solo hace falta pegar esta URL.
          </p>

          <ListGroup
            header="URL del servidor MCP"
            footer="Cuando tu asistente te pida iniciar sesión, entra con tu cuenta de Autopilot: verá solo tus propios datos."
          >
            <div className="flex items-center gap-3 py-2 pl-4 pr-2">
              <code className="selectable min-w-0 flex-1 break-all font-mono type-footnote">{mcpUrl}</code>
              <Button variant="plain" size="sm" className="shrink-0" onClick={copyUrl} aria-live="polite">
                {copied ? "Copiada" : "Copiar"}
              </Button>
            </div>
          </ListGroup>

          <ListGroup header="Conectar desde ChatGPT">
            <Steps
              items={[
                <>
                  Abre{" "}
                  <a
                    href="https://chatgpt.com/#settings/Connectors/Advanced"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    Ajustes → Conectores → Avanzado
                  </a>{" "}
                  y activa <strong>Developer mode</strong> (revisa el aviso de riesgo que aparece).
                </>,
                <>En el chat, abre el menú "+" del composer y activa <strong>Developer mode</strong>.</>,
                <>Pulsa <strong>Add sources</strong> y luego <strong>Connect more</strong>.</>,
                <>Ponle un nombre al conector (por ejemplo "Autopilot") y pega la URL de arriba.</>,
                <>Pide a ChatGPT que use Autopilot: por ejemplo, "enséñame mi plan de entrenamiento".</>,
              ]}
            />
          </ListGroup>

          <ListGroup header="Conectar desde Claude">
            <Steps
              items={[
                <>
                  Abre{" "}
                  <a
                    href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    Añadir conector personalizado en Claude
                  </a>
                  .
                </>,
                <>Ponle nombre al conector (por ejemplo "Autopilot") y pega la URL de arriba.</>,
                <>Actívalo desde el composer del chat y pídele a Claude que use Autopilot.</>,
              ]}
            />
          </ListGroup>

          <p className="px-4 type-footnote text-muted-foreground">
            <strong className="font-semibold text-foreground">¿Problemas?</strong> Asegúrate de estar en la cuenta correcta de Autopilot al iniciar sesión durante la conexión. Tu asistente solo podrá leer tu perfil, tu plan y registrar tu peso — nunca datos de otros usuarios.
          </p>
        </div>
      </Screen>
    </>
  );
};

export default Connect;
