import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type T = { id: string; name: string; result: string; text: string; photo_url: string | null };

/** Prueba social compacta para el hero: un solo testimonio real. */
const HeroTestimonial = () => {
  const [t, setT] = useState<T | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("site_testimonials")
        .select("id, name, result, text, photo_url")
        .eq("visible", true)
        .order("sort_order", { ascending: true })
        .limit(1);
      if (data?.[0]) setT(data[0]);
    })();
  }, []);

  if (!t) return null;

  return (
    <div className="mt-6 mx-auto max-w-md flex items-start gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 text-left">
      {t.photo_url ? (
        <img
          src={t.photo_url}
          alt={`Resultado de ${t.name}`}
          loading="lazy"
          className="w-9 h-9 rounded-full object-cover border border-primary/30 flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
          {t.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex gap-0.5 mb-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-2.5 h-2.5 fill-primary text-primary" />
          ))}
        </div>
        <p className="text-xs text-foreground/85 leading-relaxed line-clamp-2">“{t.text}”</p>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">
          {t.name}
          {t.result ? <span className="text-primary font-semibold"> · {t.result}</span> : null}
        </p>
      </div>
    </div>
  );
};

export default HeroTestimonial;
