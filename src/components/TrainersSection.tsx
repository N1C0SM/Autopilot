import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "lucide-react";
import CertificateLink from "@/components/CertificateLink";
import type { Database } from "@/integrations/supabase/types";

type Trainer = Database["public"]["Views"]["trainer_profiles_public"]["Row"];
type Certificate = Database["public"]["Tables"]["trainer_certificates"]["Row"];

export function TrainerPresentation({ trainer, certificates }: { trainer: Trainer; certificates: Certificate[] }) {
  return <article className="grid gap-6 border-t border-border py-8 sm:grid-cols-[96px_1fr]">
    {trainer.photo_url ? <img src={trainer.photo_url} alt={trainer.display_name || "Entrenador del equipo"} loading="lazy" className="h-24 w-24 rounded-lg object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-secondary"><User className="h-9 w-9 text-muted-foreground" /></div>}
    <div className="min-w-0 space-y-3">
      <p className="text-xs uppercase tracking-wider text-primary">Entrenador del equipo</p>
      <h3 className="font-display text-2xl font-bold break-words">{trainer.display_name || "Equipo de entrenamiento"}</h3>
      {trainer.specialty && <p className="text-sm text-primary">{trainer.specialty}</p>}
      {trainer.headline && <p className="font-medium">{trainer.headline}</p>}
      <p className="text-muted-foreground">{trainer.bio || "Te acompaña con un plan adaptado a tu nivel, tu disponibilidad y tu material."}</p>
      {certificates.length > 0 && <div className="pt-2"><h4 className="text-sm font-semibold">Formación y certificados</h4><ul className="mt-3 space-y-3">{certificates.map(c => <li key={c.id} className="space-y-1"><p className="text-sm break-words">{c.title} · {c.issuer}</p><CertificateLink path={c.file_path} title={c.title} /></li>)}</ul></div>}
    </div>
  </article>;
}

export default function TrainersSection() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [profiles, documents] = await Promise.all([
        supabase.from("trainer_profiles_public").select("*").eq("visible", true).order("sort_order"),
        supabase.from("trainer_certificates").select("*").order("created_at"),
      ]);
      if (!active) return;
      setTrainers(profiles.data || []);
      setCertificates(documents.data || []);
    })();
    return () => { active = false; };
  }, []);
  return <section id="equipo" className="border-t border-border px-4 py-16">
    <div className="container mx-auto max-w-4xl">
      <p className="text-xs uppercase tracking-widest text-primary">Quién te acompaña</p>
      <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Conoce al equipo de entrenamiento</h2>
      <p className="mt-4 mb-8 max-w-2xl text-muted-foreground">Nicolás es el fundador y dirige Autopilot. Los entrenadores del equipo se encargan de preparar y ajustar tu entrenamiento.</p>
      {trainers.length ? trainers.map(t => <TrainerPresentation key={t.id} trainer={t} certificates={certificates.filter(c => c.trainer_profile_id === t.id)} />) : <div className="border-t border-border pt-6"><h3 className="font-display text-xl font-semibold">Un equipo para acompañarte</h3><p className="mt-3 text-muted-foreground">En los planes con seguimiento, tu entrenador prepara tu plan y atiende tus dudas por chat. La dirección de Autopilot se ocupa de coordinar el servicio.</p></div>}
    </div>
  </section>;
}
