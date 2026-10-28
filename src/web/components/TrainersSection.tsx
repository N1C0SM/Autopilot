import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { User, ShieldCheck } from "lucide-react";
import CertificateLink from "@/web/components/CertificateLink";
import type { Database } from "@/shared/integrations/supabase/types";
import { usePlanAvailability } from "@/shared/lib/planCatalog";

type Trainer = Database["public"]["Views"]["trainer_profiles_public"]["Row"];
type Certificate = Database["public"]["Tables"]["trainer_certificates"]["Row"];

export function TrainerPresentation({ trainer, certificates }: { trainer: Trainer; certificates: Certificate[] }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return <article className="sep-t grid gap-6 py-8 sm:grid-cols-[96px_1fr]">
    {trainer.photo_url && !photoFailed ? <img src={trainer.photo_url} alt={trainer.display_name || "Entrenador del equipo"} loading="lazy" onError={() => setPhotoFailed(true)} className="h-24 w-24 rounded-2xl object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-secondary"><User className="h-9 w-9 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" /></div>}
    <div className="min-w-0 space-y-3">
      <p className="type-footnote text-primary">Entrenador del equipo</p>
      <h3 className="type-title2 break-words">{trainer.display_name || "Equipo de entrenamiento"}</h3>
      {trainer.specialty && <p className="type-subhead text-primary">{trainer.specialty}</p>}
      {trainer.headline && <p className="type-headline">{trainer.headline}</p>}
      <p className="type-body text-muted-foreground">{trainer.bio || "Te acompaña con un plan adaptado a tu nivel, tu disponibilidad y tu material."}</p>
      {certificates.length > 0 && <div className="pt-2">
        <p className="flex items-center gap-1.5 type-subhead font-semibold text-primary"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />Titulación verificada</p>
        <p className="mt-0.5 type-footnote text-muted-foreground">{certificates.length} {certificates.length === 1 ? "documento acreditativo" : "documentos acreditativos"}</p>
        <h4 className="mt-4 type-headline">Formación y certificados</h4>
        <ul className="mt-2 space-y-1">{certificates.map(c => <li key={c.id}><p className="type-subhead break-words">{c.title} · {c.issuer}</p><CertificateLink path={c.file_path} title={c.title} /></li>)}</ul>
      </div>}

    </div>
  </article>;
}

/** Ficha del fundador cuando no hay entrenadores visibles: foto grande, como las portadas de la landing. */
function FounderCard() {
  const [founder, setFounder] = useState<{ name: string; photo: string | null }>({ name: "Nicolás San Marcos", photo: null });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.rpc as any)("get_founder_public").then(({ data }: { data: { name: string | null; avatar_url: string | null }[] | null }) => {
      const row = data?.[0];
      if (alive && row) setFounder({ name: row.name?.trim() || "Nicolás San Marcos", photo: row.avatar_url || null });
    });
    return () => { alive = false; };
  }, []);
  return <article className="grid items-center gap-8 sm:grid-cols-[minmax(0,280px)_1fr] sm:gap-12">
    <div className="relative aspect-[4/5] w-full max-w-[280px] overflow-hidden rounded-[28px] bg-card">
      {founder.photo && !failed
        ? <img src={founder.photo} alt={founder.name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        : <div className="flex h-full w-full items-center justify-center"><User className="h-16 w-16 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /></div>}
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <p className="absolute inset-x-0 bottom-0 p-5 font-rounded text-[24px] font-bold leading-tight text-white">{founder.name}</p>
    </div>
    <div>
      <p className="type-subhead font-semibold text-primary">Fundador y desarrollador</p>
      <p className="mt-3 max-w-xl font-rounded text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">Una app que te dice qué hacer hoy, sin complicarte.</p>
      <p className="mt-4 max-w-xl type-body text-muted-foreground md:text-[19px] md:leading-[27px]">Autopilot es un proyecto independiente: la rutina, el registro y la progresión los diseña y mantiene su fundador. Cada mejora sale de lo que cuentan quienes entrenan con la app.</p>
    </div>
  </article>;
}

export default function TrainersSection() {
  const { coach, coachName } = usePlanAvailability();
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
  return <section id="equipo" className="px-5 py-14 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-6xl">
      <p className="type-subhead text-primary">Quién te acompaña</p>
      <h2 className="mt-1 type-title1 sm:text-[40px] sm:leading-[44px]">{trainers.length || coach ? "Conoce al equipo de entrenamiento" : "El fundador"}</h2>
      {(trainers.length > 0 || coach) && <p className="mb-8 mt-4 max-w-2xl type-body text-muted-foreground">{coach ? `Nicolás es el fundador y dirige Autopilot. En el plan ${coachName}, el equipo prepara y ajusta tu entrenamiento.` : "Nicolás San Marcos es el fundador y desarrollador de Autopilot."}</p>}
      {!trainers.length && !coach && <div className="mt-8" />}
      <div className={trainers.length || coach ? "max-w-3xl" : ""}>
        {trainers.length ? trainers.map(t => <TrainerPresentation key={t.id} trainer={t} certificates={certificates.filter(c => c.trainer_profile_id === t.id)} />) : coach ? <div className="sep-t pt-6"><h3 className="type-title3">Un equipo para acompañarte</h3><p className="mt-2 type-body text-muted-foreground">{`En el plan ${coachName}, tu entrenador prepara tu plan y atiende tus dudas por chat. La dirección de Autopilot se ocupa de coordinar el servicio.`}</p></div> : <FounderCard />}
      </div>
    </div>
  </section>;
}
