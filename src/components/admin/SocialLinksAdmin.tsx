import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListGroup } from "@/components/ui/list";
import { toast } from "sonner";
import { FieldRow } from "./AdminOpsParts";
import { SOCIAL_NETWORKS } from "@/lib/socialLinks";

/** Admin editor for public social links; empty fields stay hidden on the web. */
export default function SocialLinksAdmin() {
  const [id, setId] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.from("settings").select("id, social_links").limit(1).maybeSingle().then(({ data }) => {
      if (!data) return;
      setId(data.id);
      setLinks((data.social_links as Record<string, string>) || {});
    });
  }, []);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    const clean = Object.fromEntries(Object.entries(links).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    const { error } = await supabase.from("settings").update({ social_links: clean }).eq("id", id);
    setSaving(false);
    if (error) toast.error("No se pudieron guardar las redes");
    else toast.success("Redes guardadas. Vuelve a publicar para que Google las vea.");
  };

  return (
    <section className="space-y-3">
      <ListGroup header="Redes sociales" footer="Pon tu usuario (@tuusuario) o el enlace completo. Las que dejes vacías no se muestran en la web.">
        {SOCIAL_NETWORKS.map((n) => (
          <FieldRow key={n.key} label={n.label} htmlFor={`social-${n.key}`}>
            <Input
              id={`social-${n.key}`}
              value={links[n.key] || ""}
              onChange={(e) => setLinks((l) => ({ ...l, [n.key]: e.target.value }))}
              placeholder={n.key === "whatsapp" ? "+34 600 000 000" : "@tuusuario"}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              inputMode={n.key === "whatsapp" ? "tel" : "url"}
            />
          </FieldRow>
        ))}
      </ListGroup>
      <Button variant="tinted" className="w-full" onClick={() => void save()} disabled={saving || !id}>
        {saving ? "Guardando…" : "Guardar redes"}
      </Button>
    </section>
  );
}
