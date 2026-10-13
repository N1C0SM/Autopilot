import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Search, BookOpen, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHead from "@/components/PageHead";
import { hapticTap } from "@/lib/native";

const links = [
  { to: "/scan", label: "Diagnóstico gratis", desc: "Analiza tu físico en menos de 1 min", Icon: Search },
  { to: "/recursos", label: "Recursos", desc: "Blog, ebooks y recomendaciones", Icon: BookOpen },
  { to: "/login", label: "Iniciar sesión", desc: "Accede a tu plan", Icon: LogIn },
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
    <main
      className="min-h-screen bg-background px-4 flex flex-col"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <PageHead
        title="Página no encontrada (404) — Autopilot"
        description="La página que buscas no existe o se ha movido. Vuelve al inicio o empieza tu diagnóstico gratuito."
        path={location.pathname}
        noindex
      />

      <div className="relative flex h-12 items-center">
        <button
          type="button"
          onClick={() => { void hapticTap(); navigate(-1); }}
          className="-ml-2 inline-flex h-10 items-center gap-0.5 rounded-full pl-1 pr-2.5 text-foreground/85 transition-colors active:bg-secondary/60"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[15px] font-medium">Atrás</span>
        </button>
      </div>

      <div className="mx-auto w-full max-w-sm flex-1 pt-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22%] bg-secondary">
          <span className="font-display text-2xl font-bold tabular-nums text-muted-foreground">?</span>
        </div>
        <h1 className="mt-6 text-[28px] font-bold font-display leading-[1.1] tracking-[-0.03em]">
          Esta página no existe
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
          El enlace puede estar roto o la hemos movido. Volvamos a tu entrenamiento.
        </p>

        <Button asChild variant="hero" size="lg" className="mt-10 h-[52px] w-full text-[17px] font-semibold tracking-[-0.015em]">
          <Link to="/" onClick={() => void hapticTap()}>Volver al inicio</Link>
        </Button>
      </div>

      <nav aria-label="Enlaces útiles" className="mx-auto mb-6 w-full max-w-sm">
        <h2 className="mb-2 pl-1 text-[13px] font-medium uppercase tracking-wider text-muted-foreground">Enlaces útiles</h2>
        <div className="overflow-hidden rounded-2xl bg-card">
          {links.map(({ to, label, desc, Icon }, i) => (
            <Link
              key={to}
              to={to}
              onClick={() => void hapticTap()}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-secondary/50 ${i > 0 ? "border-t border-border/50" : ""}`}
            >
              <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-foreground">{label}</span>
                <span className="block text-[13px] text-muted-foreground">{desc}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
};

export default NotFound;
