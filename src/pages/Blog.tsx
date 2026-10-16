import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Newspaper } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { hapticTap } from "@/lib/native";

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

/** Cover with a composed gap when the URL is missing or fails to load. */
const PostCover = ({ url, title }: { url: string | null; title: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-secondary">
      {url && !failed
        ? <img src={url} alt={title} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        : <Newspaper className="h-8 w-8 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
    </div>
  );
};

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
        <title>Blog de entrenamiento, nutrición e hipertrofia · Autopilot</title>
        <meta
          name="description"
          content="Guías prácticas en español sobre entrenamiento de fuerza, hipertrofia, nutrición y progreso en el gimnasio o en casa."
        />
        <link rel="canonical" href="https://autopilotplan.com/blog" />
        <meta property="og:title" content="Blog de entrenamiento, nutrición e hipertrofia · Autopilot" />
        <meta property="og:description" content="Guías prácticas sobre entrenamiento, nutrición e hipertrofia." />
        <meta property="og:url" content="https://autopilotplan.com/blog" />
        <meta property="og:type" content="website" />
      </Helmet>

      <nav className="app-chrome sep-b sticky top-0 z-50 pt-safe">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex min-h-[44px] items-center type-headline text-primary transition-opacity active:opacity-60">Autopilot</Link>
          <Link to="/scan" className="flex min-h-[44px] items-center type-body text-primary transition-opacity active:opacity-60">
            Diagnóstico gratis
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-5xl px-4 pb-safe pt-8 sm:pt-16">
        <header className="mb-10 max-w-xl">
          <h1 className="type-large-title sm:text-[48px] sm:leading-[52px]">
            Entrenamiento, nutrición e <span className="text-primary">hipertrofia real</span>
          </h1>
          <p className="mt-3 type-body text-muted-foreground">
            Guías prácticas para hombres de 25 a 40 años. Sin humo, sin programas mágicos.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : posts.length === 0 ? (
          <EmptyState icon={Newspaper} title="Aún no hay artículos" description="Publicaremos guías nuevas muy pronto." />
        ) : (
          <div className="grid gap-x-6 gap-y-10 pb-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                onClick={() => void hapticTap()}
                className="block transition-opacity duration-100 active:opacity-70"
              >
                <PostCover url={p.cover_url} title={p.title} />
                <p className="mt-3 type-footnote text-muted-foreground">
                  {p.published_at && new Date(p.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                  {p.published_at && p.reading_minutes ? " · " : ""}
                  {p.reading_minutes ? `${p.reading_minutes} min` : ""}
                </p>
                <h2 className="mt-1 type-title3">{p.title}</h2>
                {p.excerpt && <p className="mt-1 line-clamp-3 type-subhead text-muted-foreground">{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Blog;
