import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/ScrollReveal";
import { User } from "lucide-react";

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
    <section className="py-32 px-4 border-t border-border">
      <div className="container mx-auto max-w-5xl">
        <ScrollReveal>
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">El equipo</p>
            <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
              Entrenadores <span className="text-gradient">verificados</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md mx-auto">
              Personas reales que diseñan, ajustan y responden tu plan cada semana.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainers.map((t, i) => (
            <ScrollReveal key={t.id} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
                className="bg-card rounded-2xl border border-border p-6 card-shadow h-full flex flex-col"
              >
                <div className="flex items-center gap-4 mb-4">
                  {t.photo_url ? (
                    <img
                      src={t.photo_url}
                      alt={t.display_name}
                      loading="lazy"
                      className="w-16 h-16 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                      <User className="w-7 h-7 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-base truncate">{t.display_name || "Entrenador"}</div>
                    {t.specialty && <div className="text-xs text-primary truncate">{t.specialty}</div>}
                  </div>
                </div>
                {t.headline && <div className="text-xs text-muted-foreground mb-3 italic">{t.headline}</div>}
                {t.bio && <p className="text-sm text-foreground/80 leading-relaxed">{t.bio}</p>}
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrainersSection;