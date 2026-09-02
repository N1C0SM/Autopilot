import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Search, BookOpen, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHead from "@/components/PageHead";

const links = [
  { to: "/scan", label: "Diagnóstico gratis", desc: "Analiza tu físico en 60s", Icon: Search },
  { to: "/recursos", label: "Recursos", desc: "Blog, ebooks y recomendaciones", Icon: BookOpen },
  { to: "/login", label: "Iniciar sesión", desc: "Accede a tu plan", Icon: LifeBuoy },
];

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn("404:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-5 py-12 sm:px-8">
      <PageHead
        title="Página no encontrada (404) — Autopilot"
        description="La página que buscas no existe o se ha movido. Vuelve al inicio o empieza tu diagnóstico gratuito."
        path={location.pathname}
        noindex
      />

      <div className="w-full max-w-2xl text-center">
        <p
          aria-hidden="true"
          className="font-display text-[5.5rem] leading-none sm:text-[8rem] md:text-[9rem] font-bold bg-gradient-to-b from-primary to-primary/30 bg-clip-text text-transparent"
        >
          404
        </p>

        <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          Esta página no existe
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm sm:text-base text-muted-foreground">
          Puede que el enlace esté roto o que la hayamos movido. Desde aquí puedes volver
          a lo importante: tu entrenamiento.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Volver al inicio
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Página anterior
          </Button>
        </div>

        <nav aria-label="Enlaces útiles" className="mt-10 grid gap-3 sm:grid-cols-3 text-left">
          {links.map(({ to, label, desc, Icon }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="mt-2 block text-sm font-medium text-foreground">{label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
};

export default NotFound;
