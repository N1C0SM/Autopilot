import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Download, ArrowRight, BookOpen } from "lucide-react";
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
      <div className="text-center max-w-md">
        <PageHead title="Confirmando tu compra · Autopilot" description="Estamos confirmando tu compra." path="/payment-success" noindex />
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <h1 className="text-2xl font-bold font-display mb-3">Confirmando tu compra...</h1>
        <p className="text-muted-foreground text-sm">Estamos verificando el pago con Stripe. Esto suele tardar unos segundos.</p>
      </div>
    );
  }

  if (state === "ready") {
    return (
      <div className="text-center max-w-md">
        <PageHead title="¡Pago exitoso! · Autopilot" description="Tu compra se ha realizado correctamente." path="/payment-success" noindex />
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-display mb-3">¡Pago Exitoso!</h1>
        <p className="text-muted-foreground mb-6">
          Gracias por tu compra. Aquí tienes tu libro:
        </p>
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left mb-6">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{title}</div>
            <div className="text-xs text-muted-foreground">PDF · descarga disponible 24 h</div>
          </div>
        </div>
        <Button variant="hero" size="lg" asChild className="w-full mb-3">
          <a href={fileUrl} target="_blank" rel="noreferrer">
            <Download className="w-4 h-4 mr-2" /> Descargar mi libro
          </a>
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/recursos")}>
          Ver más recursos <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>
    );
  }

  if (state === "nofile") {
    return (
      <div className="text-center max-w-md">
        <PageHead title="¡Pago exitoso! · Autopilot" description="Tu compra se ha realizado correctamente." path="/payment-success" noindex />
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-display mb-3">¡Pago Exitoso!</h1>
        <p className="text-muted-foreground mb-6">
          Gracias por tu compra de <span className="font-semibold text-foreground">{title}</span>.
        </p>
        <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/recursos")}>
          Ver mis recursos <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center max-w-md">
      <PageHead title="Pago recibido · Autopilot" description="Tu pago se ha procesado correctamente." path="/payment-success" noindex />
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-3xl font-bold font-display mb-3">¡Pago Recibido!</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        {state === "missing"
          ? "No pudimos verificar la compra automáticamente. Escríbenos y te enviamos tu libro hoy mismo."
          : "No hemos podido verificar el pago automáticamente. Espera unos segundos e inténtalo de nuevo, o escríbenos y te enviamos tu libro hoy mismo."}
      </p>
      {state === "error" && (
        <Button variant="outline" size="lg" className="w-full mb-3" onClick={() => window.location.reload()}>
          Comprobar de nuevo
        </Button>
      )}
      <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/recursos")}>
        Ver más recursos <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </div>
  );
};

const PaymentSuccess = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryRef = searchParams.get("client_reference_id") || "";
  const sessionId = searchParams.get("session_id") || "";
  const [pendingRef] = useState(() => readPendingBookRef());
  const bookRef = queryRef.startsWith("book-") ? queryRef : pendingRef;
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

    const checkPayment = async () => {
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
        .select("payment_status")
        .eq("user_id", user.id)
        .single();

      if (profile?.payment_status === "paid") {
        setPaid(true);
        setChecking(false);
        track("checkout_success", {});
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkPayment, 2500);
      } else {
        // Stop polling but do not falsely mark as paid
        setPaid(false);
        setChecking(false);
      }
    };

    checkPayment();
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
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <BookSuccess bookRef={bookRef} sessionId={sessionId} onNotBook={() => setNotBook(true)} />
      </div>
    );

  }

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <PageHead title="Confirmando pago · Autopilot" description="Estamos confirmando tu pago." path="/payment-success" noindex />
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Verificando tu pago...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <PageHead title="Pago recibido · Autopilot" description="Tu pago se ha procesado correctamente." path="/payment-success" noindex />
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display mb-3">¡Pago Recibido!</h1>
          <p className="text-muted-foreground mb-8">
            Por favor inicia sesión para continuar con la configuración de tu plan personalizado.
          </p>
          <Button variant="hero" size="lg" onClick={() => navigate("/login")}>
            Iniciar Sesión para Continuar
          </Button>
        </div>
      </div>
    );
  }

  if (!paid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <PageHead title="Pago en proceso · Autopilot" description="Estamos confirmando tu pago con Stripe." path="/payment-success" noindex />
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <h1 className="text-2xl font-bold font-display mb-3">Pago en proceso</h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Estamos confirmando tu pago con Stripe. Esto suele tardar unos segundos. Si en 1 minuto sigues viendo esto, refresca esta página.
          </p>
          <Button variant="hero" size="lg" onClick={() => window.location.reload()}>
            Comprobar de nuevo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <PageHead title="¡Pago exitoso! · Autopilot" description="Tu plan personalizado se está preparando." path="/payment-success" noindex />
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-display mb-3">¡Pago Exitoso!</h1>
        <p className="text-muted-foreground mb-4">
          ¡Gracias! Tu plan personalizado se está preparando.
        </p>
        <p className="text-xs text-muted-foreground mb-8">Redirigiendo al dashboard...</p>
        <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto" />
      </div>
    </div>
  );
};

export default PaymentSuccess;
