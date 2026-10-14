import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CircleAlert } from "lucide-react";
import PageHead from "@/components/PageHead";
import { ResourcesStatus, ResourcesStatusScreen } from "@/components/ResourcesStatus";
import { hapticTap } from "@/lib/native";
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
    <ResourcesStatusScreen>
      {unknown ? (
        <ResourcesStatus
          icon={CircleAlert}
          title="No hemos podido identificar tu compra"
          description="Si ya has pagado, contacta con nosotros con tu recibo para recuperar la guía."
        >
          <PageHead
            title="Compra sin confirmar · Autopilot"
            description="Todavía no hemos podido confirmar esta compra."
            path="/descarga-libro"
            noindex
          />
          <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); navigate("/recursos"); }}>
            Ver mis recursos
          </Button>
        </ResourcesStatus>
      ) : (
        <BookSuccess bookRef={bookRef} sessionId={sessionId} onNotBook={() => setUnknown(true)} />
      )}
    </ResourcesStatusScreen>
  );
};

export default BookDownload;
