import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import PageHead from "@/components/PageHead";

const PaymentSuccess = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
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
  }, [user, loading]);

  // Auto-redirect to dashboard once paid
  useEffect(() => {
    if (paid && user) {
      const timer = setTimeout(() => navigate("/dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [paid, user, navigate]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Verificando tu pago...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
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
