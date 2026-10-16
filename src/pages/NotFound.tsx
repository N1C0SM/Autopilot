import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Compass, Search, BookOpen, LogIn } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list";
import Screen from "@/components/native/Screen";
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
    <Screen
      onBack={() => navigate(-1)}
      centered
      maxWidth="sm"
      footer={
        <div className="pb-2">
          <Button asChild variant="hero" size="lg" className="w-full">
            <Link to="/" onClick={() => void hapticTap()}>Volver al inicio</Link>
          </Button>
        </div>
      }
    >
      <PageHead
        title="Página no encontrada (404) — Autopilot"
        description="La página que buscas no existe o se ha movido. Vuelve al inicio o empieza tu diagnóstico gratuito."
        path={location.pathname}
        noindex
      />

      <EmptyState
        icon={Compass}
        title="Esta página no existe"
        description="El enlace puede estar roto o la hemos movido. Volvamos a tu entrenamiento."
        className="px-0 pb-10 pt-4"
      />

      <nav aria-label="Enlaces útiles">
        <ListGroup header="Enlaces útiles">
          {links.map(({ to, label, desc, Icon }) => (
            <ListRow key={to} to={to} icon={<Icon className="text-muted-foreground" />} title={label} subtitle={desc} chevron />
          ))}
        </ListGroup>
      </nav>
    </Screen>
  );
};

export default NotFound;
