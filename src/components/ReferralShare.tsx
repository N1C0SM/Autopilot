import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MONTHLY_PRICE_EUR } from "@/config/pricing";
import { isNativeApp } from "@/lib/platform";

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
    if (!user) return;
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
      toast.success("¡Enlace copiado!");
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

  if (!referralCode) return null;

  return (
    <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-primary" />
        <h3 className="font-bold font-display">Invita y Gana</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Tu amigo recibe <span className="text-primary font-semibold">20% off</span> el primer mes. Cuando pague, tú ganas <span className="text-primary font-semibold">1 mes gratis</span> ({MONTHLY_PRICE_EUR}€ de crédito en tu próxima factura).
      </p>

      <div className="flex gap-2 mb-4">
        <div ref={linkRef} className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm font-mono truncate">
          {referralLink}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleCopy()}
          aria-label="Copiar enlace"
          className="flex-shrink-0"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      {referralCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{referralCount} amigo{referralCount !== 1 ? "s" : ""} referido{referralCount !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
};

export default ReferralShare;
