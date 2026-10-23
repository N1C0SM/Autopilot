import { functionErrorMessage } from "@/shared/lib/runtimeValues";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { Spinner } from "@/shared/components/ui/spinner";
import { ResourcesStatus, ResourcesStatusScreen } from "@/web/components/ResourcesStatus";
import { hapticTap } from "@/shared/lib/native";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/integrations/supabase/client";

type F = { title: string; url: string };

const SharedBook = () => {
  const { token = "" } = useParams();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [files, setFiles] = useState<F[]>([]);

  const download = async () => {
    setState("busy");
    const { data, error } = await supabase.functions.invoke("redeem-book-link", { body: { token } });
    if (error || !data?.url) {
      const m = await functionErrorMessage(error, "Este enlace ya se ha usado o ha caducado.");
      setMsg(m); setState("error"); return;
    }
    // Always show explicit buttons: a scripted redirect after an async call can be blocked (Safari).
    setFiles(Array.isArray(data.files) && data.files.length ? data.files : [{ title: data.title, url: data.url }]);
    setMsg(`«${data.title}»: pulsa para descargar. Los botones funcionan durante 15 minutos y el enlace ya no volverá a funcionar.`);
    setState("done");
  };

  return (
    <ResourcesStatusScreen>
      <ResourcesStatus
        icon={Download}
        title="Tu contenido de Autopilot"
        description={msg || "Este enlace solo se puede usar una vez. Pulsa el botón cuando estés listo y guarda los PDF."}
      >
        {state !== "done" && state !== "error" && (
          <Button variant="hero" size="lg" className="w-full" disabled={state === "busy"} onClick={() => { void hapticTap(); download(); }}>
            {state === "busy" ? <Spinner size="sm" className="text-primary-foreground" /> : "Descargar"}
          </Button>
        )}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f) => (
              <Button key={f.url} asChild variant="secondary" className="w-full">
                <a href={f.url} onClick={() => void hapticTap()}>{f.title}</a>
              </Button>
            ))}
          </div>
        )}
      </ResourcesStatus>
    </ResourcesStatusScreen>
  );
};

export default SharedBook;
