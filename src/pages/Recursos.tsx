import { parseRecommendations } from "@/lib/siteContent";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withBookRef } from "@/lib/buyLink";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";
import BookCover from "@/components/BookCover";
import BookPreviewModal from "@/components/BookPreviewModal";
import ItemPreviewModal, { RECOMMENDATION_VARIANT, previewIntro, type PreviewItem } from "@/components/ItemPreviewModal";
import { useAuth } from "@/contexts/AuthContext";
import UserSidebar from "@/components/UserSidebar";
import { usePlanAvailability } from "@/lib/planCatalog";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface Ebook { id?: string; title: string; description: string; cover_url: string; url: string; price: string; is_pack?: boolean }
interface Reco { id?: string; title: string; description: string; image_url: string; url: string; badge: string }
interface Post { slug: string; title: string; excerpt: string | null; cover_url: string | null }

// Sin contenido de reserva: si no hay libros o recomendaciones reales en la base de
// datos, esas secciones simplemente no se muestran (nada de material inventado).

const Recursos = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const plans = usePlanAvailability();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [previewBook, setPreviewBook] = useState<Ebook | null>(null);
  const [previewReco, setPreviewReco] = useState<PreviewItem | null>(null);
  const [recos, setRecos] = useState<Reco[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [flags, setFlags] = useState({ blog: true, ebooks: true, recos: true });

  useEffect(() => {
    (async () => {
      const settingsRes = await supabase.rpc("get_public_settings");
      const s = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
      const contact = s?.contact_email || "";

      // Libros publicados desde tu biblioteca privada
      const modeRes = await supabase.rpc("get_payment_mode");
      const live = modeRes?.data === "live";
      const { data: libraryBooks } = await supabase
        .from("library_books")
        .select("id, title, description, price, cover_path, buy_url_test, buy_url_live, is_pack")
        .eq("published", true)
        .eq("is_folder", false)
        .order("sort_order", { ascending: true });

      const fromLibrary: Ebook[] = [];
      for (const b of libraryBooks || []) {
        let cover = "";
        if (b.cover_path?.startsWith("http")) cover = b.cover_path;
        else if (b.cover_path) {
          const { data } = await supabase.storage.from("library").createSignedUrl(b.cover_path, 3600);
          if (data?.signedUrl) cover = data.signedUrl;
        }
        fromLibrary.push({
          id: b.id,
          title: b.title,
          description: b.description || "",
          cover_url: cover,
          url: withBookRef((live ? b.buy_url_live : b.buy_url_test) || (contact ? `mailto:${contact}?subject=${encodeURIComponent(`Quiero la guía: ${b.title}`)}` : ""), b.id),
          price: b.price || "",
          is_pack: !!b.is_pack,
        });
      }

      if (s) {
        const dbRecos = parseRecommendations(s.recommendations);
        setEbooks(fromLibrary);
        setRecos(dbRecos);
        setFlags({
          blog: s.show_blog ?? true,
          ebooks: true,
          recos: true,
        });
      } else if (fromLibrary.length > 0) {
        setEbooks(fromLibrary);
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

  const body = (
      <main className={embedded ? "w-full space-y-10 py-2" : "mx-auto w-full max-w-5xl space-y-10 px-4 pb-safe pt-6 md:py-10"}>
        <header>
          <h1 className="type-large-title">
            Todo lo que <span className="text-primary">complementa</span> tu plan
          </h1>
          <p className="mt-2 max-w-xl type-body text-muted-foreground">
            Guías, material recomendado y los últimos artículos del equipo.
          </p>
        </header>

        {flags.recos && recos.length > 0 && (
          <section>
            <h2 className="type-title2 mb-3">Lo que sí funciona</h2>
            <ListGroup>
              {recos.map((r, i) => (
                <ListRow
                  key={r.id || i}
                  leading={
                    r.image_url ? (
                      <img src={r.image_url} alt={r.title} loading="lazy" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <span className="block h-14 w-14 rounded-xl bg-secondary" />
                    )
                  }
                  title={r.title}
                  subtitle={<span className="line-clamp-2">{previewIntro(r.description)}</span>}
                  value={r.badge || undefined}
                  chevron
                  onClick={() => setPreviewReco(r)}
                />
              ))}
            </ListGroup>
            <ItemPreviewModal item={previewReco} variant={RECOMMENDATION_VARIANT} onClose={() => setPreviewReco(null)} />
          </section>
        )}

        {flags.ebooks && ebooks.length > 0 && (
          <section>
            <h2 className="type-title2">Guías en PDF</h2>
            <p className="mt-1 mb-5 max-w-xl type-subhead text-muted-foreground">
              Documentos para leer por tu cuenta. No incluyen plan personalizado ni seguimiento{plans.coach ? `: eso es el plan ${plans.coachName}` : ""}.
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
              {ebooks.map((e, i) => (
                <button
                  type="button"
                  key={e.id || i}
                  onClick={() => { void hapticTap(); setPreviewBook(e); }}
                  className="group min-w-0 text-left transition-transform duration-100 active:scale-[0.97]"
                >
                  <BookCover title={e.title} src={e.cover_url} />
                  <h3 className="mt-3 line-clamp-2 type-headline">{e.title}</h3>
                  <p className="mt-0.5 type-subhead font-semibold text-primary">{e.price || "Gratis"}</p>
                </button>
              ))}
            </div>
            <BookPreviewModal
              book={previewBook}
              pack={ebooks.find((b) => b.is_pack && b.url) || null}
              onClose={() => setPreviewBook(null)}
            />
          </section>
        )}

        {flags.blog && posts.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="type-title2">Últimos artículos</h2>
              <Link to="/blog" onClick={() => void hapticTap()} className="flex min-h-[44px] items-center type-body text-primary transition-opacity active:opacity-60">
                Ver todos
              </Link>
            </div>
            <ListGroup>
              {posts.map((p) => (
                <ListRow
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  leading={
                    p.cover_url ? (
                      <img src={p.cover_url} alt={p.title} loading="lazy" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <span className="block h-14 w-14 rounded-xl bg-secondary" />
                    )
                  }
                  title={p.title}
                  subtitle={p.excerpt ? <span className="line-clamp-2">{p.excerpt}</span> : undefined}
                  chevron
                />
              ))}
            </ListGroup>
          </section>
        )}

      </main>
  );

  if (embedded) return body;

  return (
    <SidebarProvider>
    <div className="min-h-screen bg-background text-foreground flex w-full">
      {user && <UserSidebar section="resources" onNavigate={(s) => navigate(s === "resources" ? "/recursos" : "/dashboard")} onSignOut={() => { signOut(); navigate("/"); }} />}
      <div className="flex-1 min-w-0">
      <Helmet>
        <title>Recursos: guías y artículos de entrenamiento · Autopilot</title>
        <meta name="description" content="Guías en PDF, recomendaciones y artículos sobre entrenamiento, nutrición e hipertrofia seleccionados por Autopilot." />
        <link rel="canonical" href="https://autopilotplan.com/recursos" />
      </Helmet>
      <header className="app-chrome sticky top-0 z-40 border-b">
        <div className="container mx-auto max-w-7xl flex items-center justify-between h-14 px-4">
          {user && <SidebarTrigger />}
          <Button variant="ghost" size="icon" onClick={() => { void hapticTap(); navigate(-1); }} aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="w-11" />
        </div>
      </header>
      {body}
      </div>
    </div>
    </SidebarProvider>
  );
};

export default Recursos;
