import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileQuestion, ChevronLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { hapticTap } from "@/lib/native";

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
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
        <Helmet>
          <title>Artículo no encontrado — Autopilot</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <EmptyState
          icon={FileQuestion}
          title="Este artículo no existe"
          description="Puede que se haya movido o que el enlace esté mal."
          action={<Button variant="plain" onClick={() => { void hapticTap(); navigate("/blog"); }}>Volver al blog</Button>}
        />
      </div>
    );
  }

  const url = `https://autopilotplan.com/blog/${post.slug}`;
  const title = post.seo_title || post.title;
  const desc = post.seo_description || post.excerpt || "";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${title} · Autopilot`}</title>
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

      <nav className="app-chrome sticky top-0 z-50 border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 pt-safe">
          <Link to="/blog" onClick={() => void hapticTap()} className="-ml-2 flex min-h-[44px] items-center gap-0.5 pr-2 type-body text-primary transition-opacity active:opacity-60">
            <ChevronLeft className="h-6 w-6" strokeWidth={2.25} /> Blog
          </Link>
          <Link to="/scan" className="flex min-h-[44px] items-center type-body text-primary transition-opacity active:opacity-60">
            Diagnóstico gratis
          </Link>
        </div>
      </nav>

      <article className="container mx-auto max-w-3xl px-4 pb-safe pt-8 sm:pt-12">
        <header className="mb-8">
          <h1 className="type-large-title sm:text-5xl sm:leading-[1.1]">{post.title}</h1>
          <p className="mt-3 type-footnote text-muted-foreground">
            {[
              post.author_name ? `Por ${post.author_name}` : "",
              post.published_at ? new Date(post.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "",
              post.reading_minutes ? `${post.reading_minutes} min` : "",
            ].filter(Boolean).join(" · ")}
          </p>
        </header>

        {post.cover_url && (
          <div className="mb-10 overflow-hidden rounded-2xl">
            <img loading="lazy" decoding="async" src={post.cover_url} alt={post.title} className="h-auto w-full object-cover" />
          </div>
        )}

        <div className="prose prose-invert prose-lg max-w-none prose-headings:font-display prose-a:text-primary prose-strong:text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body_markdown}</ReactMarkdown>
        </div>

        <aside className="mx-auto mt-16 max-w-sm text-center">
          <h3 className="type-title2">Diagnóstico físico con IA en menos de un minuto</h3>
          <p className="mt-2 type-subhead text-muted-foreground">
            Sube una foto y la IA te dirá por dónde empezar. Gratis, sin tarjeta.
          </p>
          <Button asChild variant="hero" size="lg" className="mt-6 w-full">
            <Link to="/scan" onClick={() => void hapticTap()}>Hacer mi diagnóstico gratis</Link>
          </Button>
        </aside>
      </article>
    </div>
  );
};

export default BlogPost;