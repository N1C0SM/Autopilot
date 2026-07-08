import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, BookOpen, Sparkles, Newspaper, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Ebook { id?: string; title: string; description: string; cover_url: string; url: string; price: string }
interface Reco { id?: string; title: string; description: string; image_url: string; url: string; badge: string }
interface Post { slug: string; title: string; excerpt: string | null; cover_url: string | null }

const Recursos = () => {
  const navigate = useNavigate();
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [recos, setRecos] = useState<Reco[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [flags, setFlags] = useState({ blog: true, ebooks: true, recos: true });

  useEffect(() => {
    (async () => {
      const settingsRes = await (supabase.rpc as any)("get_public_settings");
      const s = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
      if (s) {
        setEbooks(Array.isArray(s.ebooks) ? s.ebooks : []);
        setRecos(Array.isArray(s.recommendations) ? s.recommendations : []);
        setFlags({
          blog: s.show_blog ?? true,
          ebooks: s.show_ebooks ?? true,
          recos: s.show_recommendations ?? true,
        });
      }
      const { data: p } = await supabase
        .from("blog_posts")
        .select("slug, title, excerpt, cover_url")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(6);
      if (p) setPosts(p as Post[]);
    })();
  }, []);

  const nothing =
    (!flags.ebooks || ebooks.length === 0) &&
    (!flags.recos || recos.length === 0) &&
    (!flags.blog || posts.length === 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Recursos · Autopilot</title>
        <meta name="description" content="Ebooks, recomendaciones y artículos seleccionados por el equipo de Autopilot." />
      </Helmet>

      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto max-w-5xl flex items-center justify-between h-14 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver
          </Button>
          <span className="font-display font-bold text-gradient">Recursos</span>
          <span className="w-16" />
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-10 space-y-16">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-2">Biblioteca</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
            Todo lo que <span className="text-gradient">complementa</span> tu plan
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            Ebooks, suplementos que realmente usamos y los últimos artículos del equipo.
          </p>
        </div>

        {nothing && (
          <div className="text-center text-sm text-muted-foreground py-16">
            Pronto añadiremos nuevo material aquí.
          </div>
        )}

        {flags.recos && recos.length > 0 && (
          <section>
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Recomendaciones
              </p>
              <h2 className="text-2xl font-bold font-display">Lo que sí funciona</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recos.map((r, i) => (
                <a
                  key={r.id || i}
                  href={r.url || "#"}
                  target={r.url ? "_blank" : undefined}
                  rel={r.url ? "noreferrer sponsored" : undefined}
                  className="group block bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.title} loading="lazy" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-secondary shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      {r.badge && (
                        <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1">
                          {r.badge}
                        </span>
                      )}
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{r.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{r.description}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {flags.ebooks && ebooks.length > 0 && (
          <section>
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" /> Ebooks
              </p>
              <h2 className="text-2xl font-bold font-display">Guías descargables</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ebooks.map((e, i) => (
                <a
                  key={e.id || i}
                  href={e.url || "#"}
                  target={e.url ? "_blank" : undefined}
                  rel={e.url ? "noreferrer" : undefined}
                  className="group block bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors flex flex-col"
                >
                  {e.cover_url ? (
                    <div className="aspect-[4/3] bg-secondary overflow-hidden">
                      <img src={e.cover_url} alt={e.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-gradient-to-br from-primary/10 to-secondary flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-primary/60" />
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold font-display leading-snug group-hover:text-primary transition-colors">{e.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed flex-1">{e.description}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <span className="text-sm font-semibold text-primary">{e.price || "Gratis"}</span>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1 group-hover:text-primary transition-colors">
                        Ver <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {flags.blog && posts.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-6 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1.5 flex items-center gap-1.5">
                  <Newspaper className="w-3 h-3" /> Blog
                </p>
                <h2 className="text-2xl font-bold font-display">Últimos artículos</h2>
              </div>
              <Link to="/blog" className="text-sm text-primary font-semibold hover:underline inline-flex items-center gap-1">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="group block bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors flex flex-col"
                >
                  {p.cover_url ? (
                    <div className="aspect-video bg-secondary overflow-hidden">
                      <img src={p.cover_url} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary" />
                  )}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold font-display leading-snug group-hover:text-primary transition-colors line-clamp-2">{p.title}</h3>
                    {p.excerpt && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed flex-1 line-clamp-3">{p.excerpt}</p>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold mt-3">
                      Leer <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Recursos;