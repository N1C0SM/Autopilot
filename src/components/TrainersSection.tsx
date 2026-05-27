import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/ScrollReveal";
import { User, Sparkles, BadgeCheck } from "lucide-react";

interface TrainerCard {
  id: string;
  display_name: string;
  headline: string;
  bio: string;
  photo_url: string;
  specialty: string;
}

const TrainersSection = () => {
  const [trainers, setTrainers] = useState<TrainerCard[]>([]);

  useEffect(() => {
    supabase
      .from("trainer_profiles")
      .select("id, display_name, headline, bio, photo_url, specialty")
      .eq("visible", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setTrainers(data as TrainerCard[]);
      });
  }, []);

  if (trainers.length === 0) return null;

  return (
    <section className="relative py-32 px-4 border-t border-border overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 -z-10 opacity-60">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 mb-4">
              <Sparkles className="w-3 h-3 text-primary" />
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">El equipo</p>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold font-display leading-[1.05] tracking-tight">
              Entrenadores <span className="text-gradient italic font-display">verificados</span>
            </h2>
            <p className="text-muted-foreground mt-5 max-w-lg mx-auto text-base sm:text-lg leading-relaxed">
              Personas reales que diseñan, ajustan y responden tu plan cada semana. Sin bots, sin plantillas.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trainers.map((t, i) => (
            <ScrollReveal key={t.id} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="group relative h-full flex flex-col rounded-3xl border border-border bg-gradient-to-b from-card to-card/40 p-7 overflow-hidden hover:border-primary/40 transition-colors duration-500"
              >
                {/* Hover glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                {/* Photo + verified badge */}
                <div className="relative mb-5">
                  <div className="relative w-24 h-24 mx-auto">
                    {t.photo_url ? (
                      <>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/40 to-accent/30 blur-md opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
                        <img
                          src={t.photo_url}
                          alt={t.display_name}
                          loading="lazy"
                          className="relative w-24 h-24 rounded-full object-cover border-2 border-card ring-1 ring-primary/20"
                        />
                      </>
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-border">
                        <User className="w-10 h-10 text-primary/70" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-card shadow-lg">
                      <BadgeCheck className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Name + specialty */}
                <div className="text-center mb-4">
                  <div className="font-display font-bold text-lg tracking-tight">{t.display_name || "Entrenador"}</div>
                  {t.specialty && (
                    <div className="mt-1.5 inline-block text-[10px] uppercase tracking-widest text-primary font-semibold px-2.5 py-0.5 rounded-full bg-primary/10">
                      {t.specialty}
                    </div>
                  )}
                </div>

                {t.headline && (
                  <div className="text-xs text-muted-foreground mb-4 italic text-center border-l-2 border-primary/30 pl-3 mx-auto max-w-[90%]">
                    "{t.headline}"
                  </div>
                )}
                {t.bio && (
                  <p className="text-sm text-foreground/80 leading-relaxed text-center mt-auto">
                    {t.bio}
                  </p>
                )}
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrainersSection;