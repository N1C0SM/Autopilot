import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Testimonial = {
  id: string;
  name: string;
  result: string;
  text: string;
  photo_url: string | null;
};

export default function SocialProofStrip() {
  const [items, setItems] = useState<Testimonial[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("site_testimonials")
        .select("id, name, result, text, photo_url")
        .eq("visible", true)
        .order("sort_order", { ascending: true })
        .limit(3);
      if (data) setItems(data);
    })();
  }, []);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto mt-12"
    >
      <div className="text-center mb-5">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Otros con tu mismo punto de partida
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="relative bg-card/60 backdrop-blur border border-border rounded-2xl p-4"
          >
            <Quote className="absolute top-3 right-3 w-4 h-4 text-primary/30" />
            <div className="flex items-center gap-3 mb-3">
              {t.photo_url ? (
                <img
                  src={t.photo_url}
                  alt={t.name}
                  className="w-10 h-10 rounded-full object-cover border border-primary/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
                  {t.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{t.name}</div>
                {t.result && (
                  <div className="text-[10px] uppercase tracking-wider text-primary font-bold truncate">
                    {t.result}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">{t.text}</p>
            <div className="flex gap-0.5 mt-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-primary text-primary" />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}