import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CloudOff, KeyRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import Screen from "@/components/native/Screen";
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

  const frame = (children: React.ReactNode, footer?: React.ReactNode) => (
    <Screen hideBack centered maxWidth="sm" footer={footer}>{children}</Screen>
  );

  if (error) {
    return frame(<EmptyState icon={CloudOff} title="No se pudo cargar" description={error} />);
  }

  if (!details) {
    return frame(<div className="flex justify-center"><Spinner size="lg" /></div>);
  }

  const clientName = details.client?.name ?? "esta aplicación";

  return frame(
    <EmptyState
      icon={KeyRound}
      title={`Conectar ${clientName}`}
      description={`${clientName} podrá usar Autopilot en tu nombre: leer tu perfil, tu plan de entrenamiento y de nutrición, y registrar peso.`}
    />,
    <div className="space-y-1">
      <Button variant="hero" size="lg" disabled={busy} onClick={() => decide(true)} className="w-full">
        {busy ? <Spinner size="sm" className="text-primary-foreground" /> : "Autorizar"}
      </Button>
      <Button variant="plain" size="lg" disabled={busy} onClick={() => decide(false)} className="w-full">
        Denegar
      </Button>
    </div>,
  );
}
