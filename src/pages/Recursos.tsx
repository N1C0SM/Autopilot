import PublicLayout from "@/components/PublicLayout";
import { parseRecommendations } from "@/lib/siteContent";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, Newspaper, ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
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

const sentenceCase = (t: string) => {
  const v = t.trim().toLowerCase();
  return v.charAt(0).toUpperCase() + v.slice(1);
};

const RowThumb = ({ src, alt, fallback: Fallback }: { src?: string | null; alt: string; fallback: typeof Newspaper }) => {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-14 w-14 shrink-0 rounded-xl bg-secondary object-cover" />;
  }
  return (
    <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary">
      <Fallback className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
    </span>
  );
};

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
  /** Solo para mostrar carga y vacío: se marca al terminar las consultas, salga bien o mal. */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const settingsRes = await supabase.rpc("get_public_settings");
      const s = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
      const contact = s?.contact_email || "";

      // Libros publicados desde tu biblioteca privada
      const modeRes = await supabase.rpc("get_payment_mode");
      const live = modeRes?.data === "live";
      // Solo se muestra lo que está dentro de la carpeta «Libros» del Drive.
      const { data: booksFolder } = await supabase
        .from("library_books")
        .select("id")
        .eq("is_folder", true)
        .ilike("title", "libros")
        .limit(1)
        .maybeSingle();
      const { data: libraryBooks } = booksFolder
        ? await supabase
            .from("library_books")
            .select("id, title, description, price, cover_path, buy_url_test, buy_url_live, is_pack")
            .eq("published", true)
            .eq("is_folder", false)
            .eq("parent_id", booksFolder.id)
            .order("sort_order", { ascending: true })
        : { data: [] };

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
    })().finally(() => setLoaded(true));
  }, []);

  const hasRecos = flags.recos && recos.length > 0;
  const hasEbooks = flags.ebooks && ebooks.length > 0;
  const hasPosts = flags.blog && posts.length > 0;

  const body = (
      <main className={embedded ? "w-full space-y-10 py-2" : "mx-auto w-full max-w-5xl space-y-10 px-4 pb-safe pt-6 md:py-10"}>
        {/* Embebida, el título grande lo pinta la pantalla anfitriona: aquí solo va la descripción. */}
        <header>
          {embedded ? null : (
            <h1 className="type-large-title">
              Todo lo que <span className="text-primary">complementa</span> tu plan
            </h1>
          )}
          <p className={embedded ? "max-w-xl type-subhead text-muted-foreground" : "mt-2 max-w-xl type-body text-muted-foreground"}>
            Guías, material recomendado y los últimos artículos del equipo.
          </p>
        </header>

        {!loaded && (
          <div className="flex min-h-[40dvh] items-center justify-center">
            <Spinner size="lg" label="Cargando recursos" />
          </div>
        )}

        {loaded && !hasRecos && !hasEbooks && !hasPosts && (
          <EmptyState
            className="min-h-[40dvh]"
            icon={Newspaper}
            title="Sin recursos todavía"
            description="Cuando haya guías, material recomendado o artículos nuevos, aparecerán aquí."
          />
        )}

        {hasRecos && (
          <section>
            <h2 className="type-title2 mb-3">Lo que sí funciona</h2>
            <ListGroup>
              {recos.map((r, i) => (
                <ListRow
                  key={r.id || i}
                  leading={<RowThumb src={r.image_url} alt={r.title} fallback={ShoppingBag} />}
                  title={<span className="line-clamp-2">{r.title}</span>}
                  subtitle={
                    <>
                      {r.badge && <span className="block truncate type-footnote text-muted-foreground">{sentenceCase(r.badge)}</span>}
                      <span className="line-clamp-2">{previewIntro(r.description)}</span>
                    </>
                  }
                  chevron
                  onClick={() => setPreviewReco(r)}
                />
              ))}
            </ListGroup>
            <ItemPreviewModal item={previewReco} variant={RECOMMENDATION_VARIANT} onClose={() => setPreviewReco(null)} />
          </section>
        )}

        {hasEbooks && (
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
                  <p className="mt-0.5 type-subhead font-semibold text-muted-foreground">{e.price || "Gratis"}</p>
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

        {hasPosts && (
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
                  leading={<RowThumb src={p.cover_url} alt={p.title} fallback={Newspaper} />}
                  title={<span className="line-clamp-2">{p.title}</span>}
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

  if (!user) return (
    <PublicLayout title="Recursos: guías y artículos de entrenamiento · Autopilot" description="Guías en PDF, recomendaciones y artículos sobre entrenamiento, nutrición e hipertrofia seleccionados por Autopilot.">
      {body}
    </PublicLayout>
  );

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
      <header className="app-chrome sticky top-0 z-40 border-b-[0.5px]">
        <div className="container mx-auto flex h-14 max-w-7xl items-center gap-1 px-4">
          <button
            type="button"
            onClick={() => { void hapticTap(); navigate(-1); }}
            className="inline-flex h-11 items-center gap-0.5 pl-0.5 pr-2 text-primary transition-opacity active:opacity-60"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden="true" />
            <span className="type-body">Atrás</span>
          </button>
          {user && <SidebarTrigger />}
        </div>
      </header>
      {body}
      </div>
    </div>
    </SidebarProvider>
  );
};

export default Recursos;
