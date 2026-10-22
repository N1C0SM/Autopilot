import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticNotify, hapticTap } from "@/lib/native";
import { toast } from "sonner";
import { MONTHLY_PRICE_EUR } from "@/config/pricing";
import { isIOSNative, isNativeApp } from "@/lib/platform";

/** Dominio público real: en la app nativa `window.location.origin` es `capacitor://localhost`. */
const PUBLIC_WEB_ORIGIN = "https://autopilotplan.com";

const referralBaseUrl = () => {
  if (typeof window === "undefined" || isNativeApp()) return PUBLIC_WEB_ORIGIN;
  return window.location.origin;
};

const ReferralShare = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isIOSNative() || !user) return;
    let active = true;

    const loadReferralData = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("referral_code")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active) return;
        if (profile?.referral_code) setReferralCode(profile.referral_code);

        const { count } = await supabase
          .from("referrals")
          .select("*", { count: "exact", head: true })
          .eq("referrer_user_id", user.id)
          .eq("status", "completed");
        if (!active) return;
        setReferralCount(count || 0);
      } catch (error) {
        console.error("Failed to load referral data", error);
      }
    };

    void loadReferralData();
    return () => {
      active = false;
    };
  }, [user]);

  const referralLink = `${referralBaseUrl()}/signup?ref=${referralCode}`;

  /** Fallback si el portapapeles no está disponible: seleccionamos el enlace. */
  const selectLinkText = () => {
    const node = linkRef.current;
    if (!node) return false;
    try {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API no disponible");
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      void hapticNotify("success");
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy referral link", error);
      setCopied(false);
      if (selectLinkText()) {
        toast.error("No se pudo copiar automáticamente. Hemos seleccionado el enlace: cópialo manualmente.");
      } else {
        toast.error("No se pudo copiar el enlace. Cópialo manualmente.");
      }
    }
  };

  // iOS v1 (App Store §3.1.1: sin venta de bienes digitales; §3.1.3(a) no cubre fitness): referral copy announces monthly credit in €;
  // hide to stay within the "no pricing UI" rule.
  if (isIOSNative() || !referralCode) return null;

  return (
    <section>
      <div className="flex items-start gap-4">
        <Gift className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0">
          <h3 className="type-headline">Invita y gana</h3>
          <p className="mt-0.5 type-subhead text-muted-foreground">
            Tu amigo recibe <span className="font-semibold text-foreground">20% off</span> el primer mes. Cuando pague, tú ganas <span className="font-semibold text-foreground">1 mes gratis</span> ({MONTHLY_PRICE_EUR}€ de crédito en tu próxima factura).
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div ref={linkRef} className="selectable min-h-11 flex-1 truncate rounded-xl bg-card px-4 py-2.5 type-subhead">
          {referralLink}
        </div>
        <Button
          variant="tinted"
          size="icon"
          onClick={() => {
            void hapticTap();
            void handleCopy();
          }}
          aria-label="Copiar enlace"
          className="shrink-0"
        >
          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
        </Button>
      </div>

      {referralCount > 0 && (
        <div className="mt-3 flex items-center gap-2 type-subhead text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{referralCount} amigo{referralCount !== 1 ? "s" : ""} referido{referralCount !== 1 ? "s" : ""}</span>
        </div>
      )}
    </section>
  );
};

export default ReferralShare;
