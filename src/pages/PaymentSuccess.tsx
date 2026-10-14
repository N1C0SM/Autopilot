import { getConsumerPlan } from "@/lib/entitlements";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, CircleAlert, BookOpen } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ResourcesStatus, ResourcesStatusScreen } from "@/components/ResourcesStatus";
import { hapticTap, hapticNotify } from "@/lib/native";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { clearPendingBookPurchase, readPendingBookRef } from "@/lib/buyLink";

import PageHead from "@/components/PageHead";

export const BookSuccess = ({
  bookRef,
  sessionId,
  onNotBook,
}: { bookRef: string; sessionId: string; onNotBook: () => void }) => {

  const navigate = useNavigate();
  const [state, setState] = useState<"verifying" | "ready" | "nofile" | "error" | "missing">("verifying");
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => {
    if (!sessionId && !bookRef) {
      onNotBook();
      return;
    }
    if (!sessionId) {
      setState("missing");
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-book-purchase", {
          body: { session_id: sessionId || undefined, ref: bookRef || undefined },
        });
        if (error) throw new Error(error.message || "error");
        if (data?.kind === "subscription") {
          clearPendingBookPurchase();
          onNotBook();
          return;
        }
        setTitle(data?.title || "Tu compra");
        if (data?.file_url) {
          setFileUrl(data.file_url);
          setState("ready");
        } else {
          setState("nofile");
        }
        clearPendingBookPurchase();
        track("book_purchase_success", { ref: bookRef });
      } catch {
        if (!bookRef) {
          onNotBook();
          return;
        }
        setState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, bookRef]);



  if (state === "verifying") {
    return (
      <ResourcesStatus
        mark={<Spinner size="lg" className="text-primary" />}
        title="Confirmando tu compra…"
        description="Estamos verificando el pago con Stripe. Suele tardar unos segundos."
      >
        <PageHead title="Confirmando tu compra · Autopilot" description="Estamos confirmando tu compra." path="/payment-success" noindex />
      </ResourcesStatus>
    );
  }

  if (state === "ready") {
    return (
      <ResourcesStatus
        icon={CheckCircle2}
        title="¡Pago Exitoso!"
        description="Gracias por tu compra. Aquí tienes tu libro."
      >
        <PageHead title="¡Pago exitoso! · Autopilot" description="Tu compra se ha realizado correctamente." path="/payment-success" noindex />
        <div className="mb-5 flex items-center gap-3 text-left">
          <BookOpen className="h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="truncate type-headline">{title}</p>
            <p className="type-subhead text-muted-foreground">PDF · descarga disponible 24 h</p>
          </div>
        </div>
        <Button variant="hero" size="lg" asChild className="w-full">
          <a href={fileUrl} target="_blank" rel="noreferrer" onClick={() => void hapticNotify("success")}>
            Descargar mi libro
          </a>
        </Button>
        <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); navigate("/recursos"); }}>
          Ver más recursos
        </Button>
      </ResourcesStatus>
    );
  }

  if (state === "nofile") {
    return (
      <ResourcesStatus
        icon={CheckCircle2}
        title="¡Pago Exitoso!"
        description={<>Gracias por tu compra de <span className="font-semibold text-foreground">{title}</span>.</>}
      >
        <PageHead title="¡Pago exitoso! · Autopilot" description="Tu compra se ha realizado correctamente." path="/payment-success" noindex />
        <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); navigate("/recursos"); }}>
          Ver mis recursos
        </Button>
      </ResourcesStatus>
    );
  }

  return (
    <ResourcesStatus
      icon={CircleAlert}
      title="No hemos podido confirmar tu compra"
      description={
        state === "missing"
          ? "Falta la confirmación de Stripe. Si ya has pagado, contacta con nosotros con tu recibo para recuperar el libro."
          : "Espera unos segundos y comprueba de nuevo. Si ya has pagado y sigue fallando, contacta con nosotros con tu recibo."
      }
    >
      <PageHead title="Compra sin confirmar · Autopilot" description="Todavía no hemos podido confirmar esta compra." path="/payment-success" noindex />
      {state === "error" && (
        <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); window.location.reload(); }}>
          Comprobar de nuevo
        </Button>
      )}
      <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); navigate("/recursos"); }}>
        Ver más recursos
      </Button>
    </ResourcesStatus>
  );
};

const PaymentSuccess = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryRef = searchParams.get("client_reference_id") || "";
  const sessionId = searchParams.get("session_id") || "";
  const [pendingRef] = useState(() => readPendingBookRef());
  const bookRef = queryRef ? (queryRef.startsWith("book-") ? queryRef : "") : pendingRef;
  // If Stripe sends us back with a session but no tag, ask the backend what was bought.
  const [notBook, setNotBook] = useState(false);
  const isBook = !notBook && (!!bookRef || !!sessionId);
  const [checking, setChecking] = useState(true);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (isBook) return;
    if (loading) return;

    if (!user) {
      setChecking(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 12;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setChecking(true);
    setPaid(false);

    const checkPayment = async () => {
      if (cancelled) return;
      // Proactively sync with Stripe only every 3rd attempt to avoid rate limits
      if (attempts % 3 === 0) {
        try {
          await supabase.functions.invoke("check-subscription");
        } catch {
          // ignore — webhook will eventually update DB
        }
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("payment_status, subscription_tier, subscription_status, subscription_end, stripe_payment_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (getConsumerPlan(profile) !== "free") {
        setPaid(true);
        setChecking(false);
        track("checkout_success", {});
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        retryTimer = setTimeout(checkPayment, 2500);
      } else {
        // Stop polling but do not falsely mark as paid
        setPaid(false);
        setChecking(false);
      }
    };

    checkPayment();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user, loading, isBook]);

  // Auto-redirect to dashboard once paid (plan purchases only)
  useEffect(() => {
    if (isBook) return;
    if (paid && user) {
      const timer = setTimeout(() => navigate("/dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [paid, user, navigate, isBook]);

  if (isBook) {
    return (
      <ResourcesStatusScreen>
        <BookSuccess bookRef={bookRef} sessionId={sessionId} onNotBook={() => setNotBook(true)} />
      </ResourcesStatusScreen>
    );
  }

  if (loading || checking) {
    return (
      <ResourcesStatusScreen>
        <PageHead title="Confirmando pago · Autopilot" description="Estamos confirmando tu pago." path="/payment-success" noindex />
        <ResourcesStatus mark={<Spinner size="lg" className="text-primary" />} title="Verificando tu pago…" />
      </ResourcesStatusScreen>
    );
  }

  if (!user) {
    return (
      <ResourcesStatusScreen>
        <PageHead title="Confirma tu plan · Autopilot" description="Inicia sesión para comprobar el estado de tu plan." path="/payment-success" noindex />
        <ResourcesStatus
          icon={CircleAlert}
          title="Inicia sesión para confirmar tu plan"
          description="Inicia sesión para continuar con la configuración de tu plan personalizado."
        >
          <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); navigate("/login"); }}>
            Iniciar sesión para continuar
          </Button>
        </ResourcesStatus>
      </ResourcesStatusScreen>
    );
  }

  if (!paid) {
    return (
      <ResourcesStatusScreen>
        <PageHead title="Pago en proceso · Autopilot" description="Estamos confirmando tu pago con Stripe." path="/payment-success" noindex />
        <ResourcesStatus
          mark={<Spinner size="lg" className="text-primary" />}
          title="Pago en proceso"
          description="Estamos confirmando tu pago con Stripe. Suele tardar unos segundos. Si en 1 minuto sigues viendo esto, refresca la página."
        >
          <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); window.location.reload(); }}>
            Comprobar de nuevo
          </Button>
        </ResourcesStatus>
      </ResourcesStatusScreen>
    );
  }

  return (
    <ResourcesStatusScreen>
      <PageHead title="¡Pago exitoso! · Autopilot" description="Tu plan personalizado se está preparando." path="/payment-success" noindex />
      <ResourcesStatus
        icon={CheckCircle2}
        title="¡Pago Exitoso!"
        description="Gracias. Tu plan personalizado se está preparando y te llevamos al panel en un momento."
      >
        <Spinner size="md" className="mx-auto block" label="Redirigiendo" />
      </ResourcesStatus>
    </ResourcesStatusScreen>
  );
};

export default PaymentSuccess;
