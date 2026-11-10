import { useCallback, useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Unplug } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { canUnlink, LINKABLE_PROVIDERS } from "@/shared/lib/linkedAccounts";

/** Ajustes → Contraseña: Google y Apple vinculados, con opción de desconectarlos. */
export default function LinkedAccounts() {
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUserIdentities();
      setIdentities(data?.identities ?? []);
    } catch { setIdentities([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const linked = identities.filter(i => LINKABLE_PROVIDERS.some(p => p.id === i.provider));
  if (linked.length === 0) return null;

  const unlink = async (identity: UserIdentity, label: string) => {
    if (!canUnlink(identities)) {
      toast.error(`Crea una contraseña antes de desconectar ${label}, para no quedarte sin acceso.`);
      return;
    }
    setBusy(identity.provider);
    const { error } = await supabase.auth.unlinkIdentity(identity);
    setBusy(null);
    if (error) { toast.error(`No se pudo desconectar ${label}`); return; }
    toast.success(`${label} desconectado`);
    void load();
  };

  return (
    <ListGroup header="Cuentas vinculadas" footer="Desconectar quita ese acceso; sigues entrando con tu correo y contraseña.">
      {linked.map(identity => {
        const label = LINKABLE_PROVIDERS.find(p => p.id === identity.provider)!.label;
        return (
          <ListRow
            key={identity.identity_id}
            icon={<Unplug className="text-destructive" />}
            title={`Desconectar de ${label}`}
            destructive
            disabled={busy !== null}
            onClick={() => unlink(identity, label)}
          />
        );
      })}
    </ListGroup>
  );
}
