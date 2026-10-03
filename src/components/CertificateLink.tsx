import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CertificateLink({ path, title }: { path: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    // Open synchronously so browsers do not block the document after the request.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("certificate-link", { body: { path } });
      if (error || !data?.signedUrl) throw error ?? new Error("sin enlace");
      if (tab) tab.location.href = data.signedUrl;
      else window.location.assign(data.signedUrl);
    } catch {
      tab?.close();
      toast.error("No se pudo abrir el certificado. Inténtalo de nuevo.");
    } finally { setBusy(false); }
  };
  return <button type="button" disabled={busy} onClick={open} className="text-sm text-primary underline underline-offset-4 hover:text-primary/80 disabled:opacity-50" aria-label={`Ver certificado: ${title}`}>{busy ? "Abriendo…" : "Ver certificado"}</button>;
}
