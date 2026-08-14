import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MONTHLY_PRICE_EUR } from "@/config/pricing";

const ReferralShare = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("user_id", user.id)
        .single();
      if (profile?.referral_code) setReferralCode(profile.referral_code);

      const { count } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_user_id", user.id)
        .eq("status", "completed");
      setReferralCount(count || 0);
    };
    fetch();
  }, [user]);

  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("¡Enlace copiado!");
    setTimeout(() => setCopied(false), 2000);
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
        <div className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm font-mono truncate">
          {referralLink}
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy} className="flex-shrink-0">
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
