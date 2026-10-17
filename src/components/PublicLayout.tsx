import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";

const navigation = [
  ["/como-funciona", "Cómo funciona"], ["/planes", "Planes"], ["/equipo", "Equipo"],
  ["/recursos", "Recursos"], ["/preguntas-frecuentes", "Dudas"],
] as const;

export default function PublicLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const [showApp, setShowApp] = useState(false);
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
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Abrir menú" onClick={() => void hapticTap()}><Menu className="h-6 w-6" strokeWidth={1.75} /></Button></SheetTrigger>
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
    <main id="contenido" className="min-w-0 scroll-mt-20">{children}</main>
    <footer className="sep-t px-5 pb-[calc(2rem+var(--safe-bottom))] pt-8">
      <div className="container mx-auto flex max-w-6xl flex-col gap-4 type-footnote text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <p className="py-3"><span className="font-semibold text-foreground">Autopilot</span> · {new Date().getFullYear()}</p>
        <div className="flex flex-wrap items-start gap-x-6">
          <Link to="/preguntas-frecuentes" className="inline-flex min-h-11 items-center transition-opacity hover:text-foreground active:opacity-60">Ayuda</Link>
          <Link to="/para-entrenadores" className="inline-flex min-h-11 items-center transition-opacity hover:text-foreground active:opacity-60">Para entrenadores</Link>
          {showApp && <Link to="/app" className="inline-flex min-h-11 items-center transition-opacity hover:text-foreground active:opacity-60">App móvil</Link>}
          <Link to="/blog" className="inline-flex min-h-11 items-center transition-opacity hover:text-foreground active:opacity-60">Blog</Link>
          <details className="group">
            <summary className="flex min-h-11 list-none items-center gap-1 py-3 transition-opacity active:opacity-60 [&::-webkit-details-marker]:hidden">Información legal<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-ios group-open:rotate-180" aria-hidden="true" /></summary>
            <div className="flex flex-col">
              {[["aviso-legal", "Aviso legal"], ["terminos", "Términos"], ["privacidad", "Privacidad"], ["cookies", "Cookies"], ["disclaimer-medico", "Información de salud"]].map(([slug, label]) => <Link key={slug} className="min-h-11 py-3 transition-opacity active:opacity-60" to={`/legal/${slug}`}>{label}</Link>)}
              <Link to="/connect" className="min-h-11 py-3 transition-opacity active:opacity-60">Conectar con IA</Link>
            </div>
          </details>
        </div>
      </div>
    </footer>
  </div>;
}
