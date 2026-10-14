import { useEffect, useState } from "react";
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
      const { data } = await supabase
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
    <section className="max-w-3xl mx-auto mt-12 px-4">
      <h2 className="type-title2 text-center">Otros con tu mismo punto de partida</h2>
      <div className="grid sm:grid-cols-3 gap-8 mt-8">
        {items.map((t) => (
          <figure key={t.id}>
            <div className="flex items-center gap-3 mb-3">
              {t.photo_url ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={t.photo_url}
                  alt={t.name}
                  className="w-11 h-11 rounded-full object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center type-headline text-primary">
                  {t.name.charAt(0).toUpperCase()}
                </div>
              )}
              <figcaption className="min-w-0">
                <div className="type-headline truncate">{t.name}</div>
                {t.result && <div className="type-subhead text-primary truncate">{t.result}</div>}
              </figcaption>
            </div>
            <blockquote className="type-subhead text-muted-foreground line-clamp-4">{t.text}</blockquote>
          </figure>
        ))}
      </div>
    </section>
  );
}
