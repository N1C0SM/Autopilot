import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Testimonial = {
  id: string;
  name: string;
  result: string;
  text: string;
  photo_url: string | null;
};

// Falls back to the initial when there is no photo or it fails to load.
function TestimonialAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (photoUrl && !failed) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={photoUrl}
        alt={name}
        onError={() => setFailed(true)}
        className="w-11 h-11 shrink-0 rounded-full bg-secondary object-cover"
      />
    );
  }
  return (
    <div className="w-11 h-11 shrink-0 rounded-full bg-secondary flex items-center justify-center type-headline text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

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
    <section>
      <h2 className="type-title2">Otros con tu mismo punto de partida</h2>
      <div className="grid sm:grid-cols-3 gap-8 mt-6">
        {items.map((t) => (
          <figure key={t.id}>
            <div className="flex items-center gap-3 mb-3">
              <TestimonialAvatar name={t.name} photoUrl={t.photo_url} />
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
