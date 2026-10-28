import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";

/** Lee el interruptor público de Admin para la página de descarga del APK. null = cargando. */
export function useApkDownloadEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.rpc as any)("get_apk_download_enabled").then(({ data, error }: { data: unknown; error: unknown }) => {
      setEnabled(error ? true : data !== false);
    });
  }, []);
  return [enabled, setEnabled] as const;
}
