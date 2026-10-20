import { useEffect, useState } from "react";
import { PhoneAppBar, PhoneFrame, PhoneHome } from "@/components/PublicPhone";
import { usePlanAvailability } from "@/lib/planCatalog";
import { supabase } from "@/integrations/supabase/client";

const FADE = "linear-gradient(to bottom, #000 80%, transparent 100%)";

/** Founder photo, or their initial when it is missing or fails to load. */
function OwnerAvatar({ photo, initial }: { photo: string | null; initial: string }) {
  const [failed, setFailed] = useState(false);
  return photo && !failed ? <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" /> : <>{initial}</>;
}

/**
 * Static picture of the app's "Hoy" screen for the landing hero. The phone rises from the
 * section edge and fades out. Name and photo come from Ajustes (get_founder_public), the
 * same source the interactive demo uses, so both mockups always show the same identity.
 */
export default function PublicHeroPhone() {
  const plans = usePlanAvailability();
  const [owner, setOwner] = useState<{ name: string; photo: string | null }>({ name: "Nicolás", photo: null });
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("get_founder_public").then(({ data }: { data: { name: string | null; avatar_url: string | null }[] | null }) => {
      const row = data?.[0];
      if (alive && row) setOwner({ name: row.name?.trim() || "Nicolás", photo: row.avatar_url || null });
    });
    return () => { alive = false; };
  }, []);
  const ownerFirst = owner.name.split(" ")[0];
  const ownerInitial = ownerFirst.charAt(0).toUpperCase();

  return (
    <div
      role="img"
      aria-label="Pantalla de Autopilot con el entrenamiento del día"
      style={{ WebkitMaskImage: FADE, maskImage: FADE }}
      className="relative mx-auto h-[31rem] w-full max-w-[22rem] overflow-hidden select-none"
    >
      <PhoneFrame screenClassName="h-[37rem]">
        <PhoneAppBar avatar={<OwnerAvatar photo={owner.photo} initial={ownerInitial} />} />
        <div className="flex-1 overflow-hidden px-4 pt-3">
          <PhoneHome plans={plans} />
        </div>
      </PhoneFrame>
    </div>
  );
}
