import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import PageHead from "@/components/PageHead";
import { readPendingBookRef } from "@/lib/buyLink";
import { BookSuccess } from "./PaymentSuccess";

/**
 * Dedicated return page for book / pack purchases.
 * Stripe payment links for books redirect here, so there is never any
 * confusion with the monthly plan confirmation page.
 */
const BookDownload = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryRef = searchParams.get("client_reference_id") || "";
  const sessionId = searchParams.get("session_id") || "";
  const [pendingRef] = useState(() => readPendingBookRef());
  const bookRef = queryRef.startsWith("book-") ? queryRef : pendingRef;
  const [unknown, setUnknown] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {unknown ? (
        <div className="text-center max-w-md">
          <PageHead
            title="Pago recibido · Autopilot"
            description="Tu pago se ha procesado correctamente."
            path="/descarga-libro"
            noindex
          />
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display mb-3">¡Pago Recibido!</h1>
          <p className="text-muted-foreground mb-8 text-sm">
            No hemos podido identificar automáticamente la guía comprada. Escríbenos y te la enviamos hoy mismo.
          </p>
          <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/recursos")}>
            Ver mis recursos <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      ) : (
        <BookSuccess bookRef={bookRef} sessionId={sessionId} onNotBook={() => setUnknown(true)} />
      )}
    </div>
  );
};

export default BookDownload;
