import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navigation = [
  ["/como-funciona", "Cómo funciona"], ["/planes", "Planes"], ["/equipo", "Equipo"],
  ["/recursos", "Recursos"], ["/preguntas-frecuentes", "Dudas"],
] as const;

export default function PublicLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();
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
    </Helmet>
    <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[60] focus:bg-background focus:p-3">Saltar al contenido</a>
    <header className="app-chrome sticky top-0 z-50 border-b">
      <div className="container mx-auto flex h-16 min-w-0 items-center justify-between gap-3 px-4">
        <Link to="/" aria-label="Autopilot, inicio" className="inline-flex min-h-11 items-center font-display text-xl font-bold text-primary">Autopilot</Link>
        <nav aria-label="Navegación principal" className="hidden items-center gap-1 lg:flex">
          {navigation.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `inline-flex min-h-11 items-center px-3 text-sm transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</NavLink>)}
          <Button variant="ghost" asChild className="min-h-11"><Link to="/login">Iniciar sesión</Link></Button>
          <Button asChild className="min-h-11"><Link to="/onboarding">Crear mi rutina</Link></Button>
        </nav>
        <div className="flex items-center gap-2 lg:hidden">
          <Button asChild size="sm" className="min-h-11 px-3 text-xs"><Link to="/onboarding">Crear mi rutina</Link></Button>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild><Button variant="outline" size="icon" className="h-11 w-11" aria-label="Abrir menú"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent className="w-[min(90vw,360px)] overflow-y-auto px-5">
              <SheetTitle className="font-display text-xl text-primary">Autopilot</SheetTitle>
              <SheetDescription>Elige qué quieres consultar.</SheetDescription>
              <nav aria-label="Menú móvil" className="mt-6 flex flex-col gap-1">
                <Link to="/" onClick={() => setMenuOpen(false)} className="min-h-11 rounded-md px-3 py-3">Inicio</Link>
                {navigation.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `min-h-11 rounded-md px-3 py-3 ${isActive ? "bg-secondary text-primary" : "hover:bg-secondary"}`}>{label}</NavLink>)}
                <Link to="/login" onClick={() => setMenuOpen(false)} className="min-h-11 rounded-md px-3 py-3">Iniciar sesión</Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    <main id="contenido" className="min-w-0 scroll-mt-20">{children}</main>
    <footer className="border-t border-border px-4 py-7">
      <div className="container mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <p className="py-3"><span className="font-display font-bold text-foreground">Autopilot</span> · {new Date().getFullYear()}</p>
        <div className="flex flex-wrap items-start gap-x-5">
          <Link to="/preguntas-frecuentes" className="inline-flex min-h-11 items-center hover:text-foreground">Ayuda</Link>
          <Link to="/para-entrenadores" className="inline-flex min-h-11 items-center hover:text-foreground">Para entrenadores</Link>
          <Link to="/blog" className="inline-flex min-h-11 items-center hover:text-foreground">Blog</Link>
          <details>
            <summary className="min-h-11 cursor-pointer py-3">Información legal</summary>
            <div className="flex flex-col">
              {[["aviso-legal", "Aviso legal"], ["terminos", "Términos"], ["privacidad", "Privacidad"], ["cookies", "Cookies"], ["disclaimer-medico", "Información de salud"]].map(([slug, label]) => <Link key={slug} className="min-h-11 py-3" to={`/legal/${slug}`}>{label}</Link>)}
              <Link to="/connect" className="min-h-11 py-3">Conectar con IA</Link>
            </div>
          </details>
        </div>
      </div>
    </footer>
  </div>;
}
