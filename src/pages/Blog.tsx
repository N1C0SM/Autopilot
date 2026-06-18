import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Calendar, Clock, ArrowRight } from "lucide-react";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
  reading_minutes: number | null;
  author_name: string | null;
}

const Blog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, published_at, reading_minutes, author_name")
        .eq("published", true)
        .order("published_at", { ascending: false });
      setPosts((data || []) as Post[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Blog Autopilot — Entrenamiento, nutrición e hipertrofia</title>
        <meta
          name="description"
          content="Guías prácticas sobre entrenamiento, nutrición e hipertrofia para hombres de 25 a 40 años. Escritas por entrenadores reales."
        />
        <link rel="canonical" href="https://autopilotplan.com/blog" />
        <meta property="og:title" content="Blog Autopilot" />
        <meta property="og:description" content="Guías prácticas sobre entrenamiento, nutrición e hipertrofia." />
        <meta property="og:url" content="https://autopilotplan.com/blog" />
        <meta property="og:type" content="website" />
      </Helmet>

      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="font-display text-xl font-bold text-gradient">Autopilot</Link>
          <Link to="/scan" className="text-sm text-primary font-medium hover:underline">
            Diagnóstico gratis →
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-4xl px-4 py-16 sm:py-24">
        <header className="mb-12 text-center">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Blog</p>
          <h1 className="text-4xl sm:text-5xl font-bold font-display tracking-tight mb-4">
            Entrenamiento, nutrición e <span className="text-gradient">hipertrofia real</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            Guías prácticas para hombres de 25 a 40 años. Sin humo, sin programas mágicos.
          </p>
        </header>

        {loading ? (
          <p className="text-center text-muted-foreground">Cargando…</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-card border border-dashed border-border rounded-2xl">
            <p className="text-sm text-muted-foreground">Aún no hay artículos publicados.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-colors flex flex-col"
              >
                {p.cover_url && (
                  <div className="aspect-video bg-secondary overflow-hidden">
                    <img
                      src={p.cover_url}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
                    {p.published_at && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {p.reading_minutes ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {p.reading_minutes} min
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-lg font-bold font-display leading-snug mb-2 group-hover:text-primary transition-colors">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">{p.excerpt}</p>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold mt-4">
                    Leer artículo <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Blog;