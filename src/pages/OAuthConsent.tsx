import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { hapticTap } from "@/lib/native";

type AuthorizationDetails = {
  client?: { name?: string; logo_uri?: string };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};

// Local typed wrapper for the beta supabase.auth.oauth namespace.
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
    approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
    denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  };
}).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Falta authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    void hapticTap();
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("El servidor de autorización no devolvió una URL de redirección.");
    }
    window.location.href = target;
  }

  const frame = (children: React.ReactNode) => (
    <main
      className="min-h-screen flex items-center justify-center bg-background px-4"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );

  if (error) {
    return frame(
      <div className="text-center">
        <h1 className="text-[28px] font-bold font-display leading-[1.1] tracking-[-0.03em]">No se pudo cargar</h1>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!details) {
    return frame(<div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>);
  }

  const clientName = details.client?.name ?? "esta aplicación";

  return frame(
    <>
      <div className="text-center">
        <h1 className="text-[28px] font-bold font-display leading-[1.1] tracking-[-0.03em]">Conectar {clientName}</h1>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
          {clientName} podrá usar Autopilot en tu nombre: leer tu perfil, tu plan de entrenamiento y de nutrición, y registrar peso.
        </p>
      </div>
      <div className="mt-10 space-y-2">
        <Button variant="hero" size="lg" disabled={busy} onClick={() => decide(true)} className="h-[52px] w-full text-[17px] font-semibold tracking-[-0.015em]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Autorizar"}
        </Button>
        <Button variant="ghost" size="lg" disabled={busy} onClick={() => decide(false)} className="h-[52px] w-full text-[17px] text-primary">
          Denegar
        </Button>
      </div>
    </>
  );
}
