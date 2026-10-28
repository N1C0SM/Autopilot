import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
let current = false;
let pending: Promise<void> | null = null;
const listeners = new Set<(active: boolean) => void>();
export function refreshFreeCampaign() {
  if (pending) return pending;
  pending = Promise.resolve(supabase.rpc("get_free_campaign")).then(({ data, error }) => {
    if (!error && typeof data === "boolean") { current = data; listeners.forEach((listener) => listener(current)); }
  }).finally(() => { pending = null; });
  return pending;
}
export function useFreeCampaign() {
  const [active, setActive] = useState(current);
  useEffect(() => {
    listeners.add(setActive);
    void refreshFreeCampaign();
    const onFocus = () => { void refreshFreeCampaign(); };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 30000);
    return () => { listeners.delete(setActive); window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, []);
  return active;
}
