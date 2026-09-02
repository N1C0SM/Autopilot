import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Captura errores de render en toda la app y muestra una pantalla amable
 * en lugar de una página en blanco.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary:", error, info.componentStack);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
            Algo ha fallado
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Hemos tenido un problema cargando esta pantalla. Recarga la página; si
            vuelve a ocurrir, escríbenos desde el chat.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-center">
            <Button onClick={() => window.location.reload()} size="lg">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Recargar
            </Button>
            <Button variant="outline" size="lg" onClick={() => (window.location.href = "/")}>
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Ir al inicio
            </Button>
          </div>
        </div>
      </main>
    );
  }
}
