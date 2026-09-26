import { useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const SharedBook = () => {
  const { token = "" } = useParams();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const download = async () => {
    setState("busy");
    const { data, error } = await supabase.functions.invoke("redeem-book-link", { body: { token } });
    if (error || !data?.url) {
      let m = "Este enlace ya se ha usado o ha caducado.";
      try { m = JSON.parse(await (error as any)?.context?.text?.()).error || m; } catch { /* keep */ }
      setMsg(m); setState("error"); return;
    }
    window.location.href = data.url;
    setMsg(`«${data.title}» se está descargando. Este enlace ya no volverá a funcionar.`);
    setState("done");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Download className="w-9 h-9 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-display mb-3">Tu libro de Autopilot</h1>
        <p className="text-muted-foreground mb-8 text-sm">
          {msg || "Este enlace solo permite una descarga. Pulsa el botón cuando estés listo y guarda el PDF."}
        </p>
        {state !== "done" && state !== "error" && (
          <Button variant="hero" size="lg" className="w-full" disabled={state === "busy"} onClick={download}>
            {state === "busy" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Descargar PDF"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default SharedBook;
