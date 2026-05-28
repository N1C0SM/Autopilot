import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/ScrollReveal";
import { User, Sparkles, BadgeCheck, Quote } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

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
      <div className="absolute inset-0 -z-10 opacity-60 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[140px]" />
      </div>

      <div className="container mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="text-center mb-14">
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

        <Carousel
          opts={{ align: "start", loop: trainers.length > 2 }}
          plugins={trainers.length > 1 ? [Autoplay({ delay: 5000, stopOnInteraction: true })] : []}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {trainers.map((t, i) => (
              <CarouselItem key={t.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -8 }}
                  className="group relative h-full rounded-3xl border border-border bg-gradient-to-b from-card via-card/80 to-card/40 overflow-hidden hover:border-primary/50 transition-colors duration-500"
                >
                  {/* Hover glow */}
                  <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                  {/* Photo cover */}
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {t.photo_url ? (
                      <img
                        src={t.photo_url}
                        alt={t.display_name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                        <User className="w-20 h-20 text-primary/40" />
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

                    {/* Verified badge */}
                    <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md border border-primary/30">
                      <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Verificado</span>
                    </div>

                    {/* Name + specialty floating */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <div className="font-display font-bold text-xl tracking-tight mb-1.5 leading-tight">
                        {t.display_name || "Entrenador"}
                      </div>
                      {t.specialty && (
                        <div className="inline-block text-[10px] uppercase tracking-widest text-primary font-semibold px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30">
                          {t.specialty}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-3">
                    {t.headline && (
                      <div className="relative pl-5">
                        <Quote className="absolute top-0 left-0 w-3.5 h-3.5 text-primary/50" />
                        <p className="text-sm italic text-foreground/80 leading-snug">{t.headline}</p>
                      </div>
                    )}
                    {t.bio && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{t.bio}</p>
                    )}
                  </div>
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {trainers.length > 1 && (
            <>
              <CarouselPrevious className="hidden md:flex -left-4 lg:-left-12" />
              <CarouselNext className="hidden md:flex -right-4 lg:-right-12" />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
};

export default TrainersSection;