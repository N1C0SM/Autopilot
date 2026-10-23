import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import { socialLinkList } from "@/lib/socialLinks";
import AppStoreBadges from "@/components/AppStoreBadges";

const navigation = [
  ["/como-funciona", "Cómo funciona"], ["/planes", "Planes"], ["/equipo", "Equipo"],
  ["/recursos", "Recursos"], ["/preguntas-frecuentes", "Dudas"],
] as const;

export default function PublicLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const [showApp, setShowApp] = useState(false);
  const [socials, setSocials] = useState<ReturnType<typeof socialLinkList>>([]);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("get_social_links_public").then(({ data }) => { if (alive) setSocials(socialLinkList(data)); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("get_public_settings").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (alive && row) setShowApp(row.show_app_download !== false);
    });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let observer: MutationObserver | undefined;
    const scrollToAnchor = () => {
      const target = hash ? document.getElementById(hash.slice(1)) : null;
      if (!target) return false;
      target.scrollIntoView({ block: "start" });
      observer?.disconnect();
      return true;
    };
    const frame = requestAnimationFrame(() => {
      if (scrollToAnchor()) return;
      window.scrollTo(0, 0);
      if (hash) {
        // The demo may arrive after the lazy page has loaded.
        observer = new MutationObserver(scrollToAnchor);
        observer.observe(document.getElementById("contenido") || document.body, { childList: true, subtree: true });
      }
    });
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [pathname, hash]);

  return <div className="min-h-screen bg-background text-foreground">
    <Helmet>
      <title>{title} · Autopilot</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={`https://autopilotplan.com${pathname}`} />
      <meta property="og:title" content={`${title} · Autopilot`} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={`https://autopilotplan.com${pathname}`} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="https://autopilotplan.com/og-image.png" />
      <meta name="twitter:title" content={`${title} · Autopilot`} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content="https://autopilotplan.com/og-image.png" />
    </Helmet>
    <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[60] focus:bg-background focus:p-3">Saltar al contenido</a>
    <header className="app-chrome sep-b sticky top-0 z-50 pt-safe">
      <div className="container mx-auto flex h-14 min-w-0 items-center justify-between gap-3 px-4">
        <Link to="/" aria-label="Autopilot, inicio" className="inline-flex min-h-11 items-center type-headline text-primary transition-opacity active:opacity-60">Autopilot</Link>
        <nav aria-label="Navegación principal" className="hidden items-center gap-1 lg:flex">
          {navigation.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `inline-flex min-h-11 items-center px-3 type-subhead transition-colors active:opacity-60 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</NavLink>)}
          {showApp && <NavLink to="/app" className="inline-flex min-h-11 items-center px-3 type-subhead text-muted-foreground transition-colors hover:text-foreground active:opacity-60">App móvil</NavLink>}
          <Button variant="plain" asChild><Link to="/login">Iniciar sesión</Link></Button>
          <Button variant="tinted" asChild><Link to="/onboarding-choice">Crear mi rutina</Link></Button>
        </nav>
        <div className="flex items-center lg:hidden">
          <Button variant="plain" asChild><Link to="/onboarding-choice" onClick={() => void hapticTap()}>Crear mi rutina</Link></Button>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Abrir menú" onClick={() => void hapticTap()}><Menu className="h-6 w-6" strokeWidth={2} /></Button></SheetTrigger>
            <SheetContent className="w-[min(90vw,360px)] overflow-y-auto px-4" onOpenAutoFocus={(e) => e.preventDefault()}>
              <SheetTitle className="text-primary">Autopilot</SheetTitle>
              <SheetDescription>Elige qué quieres consultar.</SheetDescription>
              <nav aria-label="Menú móvil" className="mt-6 space-y-6">
                <ListGroup inset>
                  <ListRow to="/" chevron title={<span className={pathname === "/" ? "text-primary" : undefined}>Inicio</span>} onClick={() => setMenuOpen(false)} />
                  {navigation.map(([to, label]) => <ListRow key={to} to={to} chevron title={<span className={pathname === to ? "text-primary" : undefined}>{label}</span>} onClick={() => setMenuOpen(false)} />)}
                  {showApp && <ListRow to="/app" chevron title="App móvil" onClick={() => setMenuOpen(false)} />}
                </ListGroup>
                <ListGroup inset>
                  <ListRow to="/login" chevron title="Iniciar sesión" onClick={() => setMenuOpen(false)} />
                </ListGroup>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    <main id="contenido" className="reveal-sections min-w-0 scroll-mt-20">{children}</main>
    <footer className="sep-t px-5 pb-[calc(2rem+var(--safe-bottom))] pt-14 sm:px-8 sm:pt-20">
      <div className="container mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="font-rounded text-[28px] font-bold tracking-tight text-primary">Autopilot</Link>
            <p className="mt-3 max-w-xs type-subhead text-muted-foreground">Entrena con plan. Registra cada serie. Mira cómo progresas.</p>
            <Button variant="tinted" asChild className="mt-6"><Link to="/onboarding" onClick={() => void hapticTap()}>Crear mi rutina gratis</Link></Button>
            <AppStoreBadges size="compact" align="start" className="mt-5" />
          </div>
          {[
            ["Producto", [["/como-funciona", "Cómo funciona"], ["/planes", "Planes"], ...(showApp ? [["/app", "App móvil"]] : []), ["/para-entrenadores", "Para entrenadores"]]],
            ["Recursos", [["/recursos", "Guías en PDF"], ["/blog", "Blog"], ["/preguntas-frecuentes", "Ayuda"], ["/equipo", "Equipo"]]],
          ].map(([heading, links]) => <nav key={heading as string} aria-label={heading as string}>
            <p className="type-footnote font-semibold text-foreground">{heading as string}</p>
            <ul className="mt-2">{(links as string[][]).map(([to, label]) => <li key={to}><Link to={to} className="inline-flex min-h-11 items-center type-subhead text-muted-foreground transition-colors hover:text-foreground active:opacity-60">{label}</Link></li>)}</ul>
          </nav>)}
          <div>
            <p className="type-footnote font-semibold text-foreground">Síguenos</p>
            <ul className="mt-2">
              {socials.map((l) => <li key={l.key}><a href={l.url} target="_blank" rel="noopener noreferrer me" className="inline-flex min-h-11 items-center type-subhead text-muted-foreground transition-colors hover:text-foreground active:opacity-60">{l.label}</a></li>)}
              <li><Link to="/connect" className="inline-flex min-h-11 items-center type-subhead text-muted-foreground transition-colors hover:text-foreground active:opacity-60">Conectar con IA</Link></li>
            </ul>
          </div>
        </div>
        <div className="sep-t mt-12 flex flex-col gap-2 pt-6 type-footnote text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-semibold text-foreground">Autopilot</span> · {new Date().getFullYear()}</p>
          <nav aria-label="Información legal" className="flex flex-wrap gap-x-5">
            {[["aviso-legal", "Aviso legal"], ["terminos", "Términos"], ["privacidad", "Privacidad"], ["cookies", "Cookies"], ["disclaimer-medico", "Información de salud"]].map(([slug, label]) => <Link key={slug} className="inline-flex min-h-11 items-center transition-colors hover:text-foreground active:opacity-60" to={`/legal/${slug}`}>{label}</Link>)}
          </nav>
        </div>
      </div>
    </footer>
  </div>;
}
