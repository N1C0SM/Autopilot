import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Calendar, Clock, ArrowLeft, Loader2 } from "lucide-react";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_markdown: string;
  cover_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  reading_minutes: number | null;
  author_name: string | null;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setPost(data as Post);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Helmet>
          <title>Artículo no encontrado — Autopilot</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <p className="text-muted-foreground mb-4">Este artículo no existe.</p>
        <button onClick={() => navigate("/blog")} className="text-primary hover:underline text-sm">
          ← Volver al blog
        </button>
      </div>
    );
  }

  const url = `https://autopilotplan.com/blog/${post.slug}`;
  const title = post.seo_title || post.title;
  const desc = post.seo_description || post.excerpt || "";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title} — Autopilot</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        {post.cover_url && <meta property="og:image" content={post.cover_url} />}
        {post.published_at && <meta property="article:published_time" content={post.published_at} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={desc} />
        {post.cover_url && <meta name="twitter:image" content={post.cover_url} />}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: desc,
          image: post.cover_url || undefined,
          datePublished: post.published_at,
          author: { "@type": "Person", name: post.author_name || "Autopilot" },
          publisher: { "@type": "Organization", name: "Autopilot", url: "https://autopilotplan.com" },
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
        })}</script>
      </Helmet>

      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="font-display text-xl font-bold text-gradient">Autopilot</Link>
          <Link to="/scan" className="text-sm text-primary font-medium hover:underline">
            Diagnóstico gratis →
          </Link>
        </div>
      </nav>

      <article className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <Link to="/blog" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-3 h-3" /> Volver al blog
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight leading-[1.1] mb-4">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {post.author_name && <span>Por {post.author_name}</span>}
            {post.published_at && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(post.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
            {post.reading_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {post.reading_minutes} min
              </span>
            ) : null}
          </div>
        </header>

        {post.cover_url && (
          <div className="mb-10 rounded-2xl overflow-hidden border border-border">
            <img src={post.cover_url} alt={post.title} className="w-full h-auto object-cover" />
          </div>
        )}

        <div className="prose prose-invert prose-lg max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-primary prose-strong:text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body_markdown}</ReactMarkdown>
        </div>

        <div className="mt-16 p-6 sm:p-8 bg-card border border-primary/30 rounded-2xl text-center">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-2">¿Listo para empezar?</p>
          <h3 className="text-xl sm:text-2xl font-bold font-display mb-3">
            Diagnóstico físico con IA en 60 segundos
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            Sube una foto y un entrenador real te dirá por dónde empezar. Gratis, sin tarjeta.
          </p>
          <Link to="/scan" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
            Hacer mi diagnóstico gratis →
          </Link>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;