import { Component, type ErrorInfo, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  retryKey: number;
  attempts: number;
}

const MAX_AUTO_RETRIES = 3;

/**
 * Captura errores de render y se recupera sola: reintenta el render en silencio
 * en lugar de mostrar una pantalla de error al usuario.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0, attempts: 0 };
  private timer: number | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    try {
      sessionStorage.removeItem("autopilot_auto_reload");
    } catch {
      /* ignorar */
    }
  }


  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error?.name, error?.message, error?.stack, info.componentStack);
    if (this.state.attempts < MAX_AUTO_RETRIES) {
      this.timer = window.setTimeout(() => {
        this.setState((s) => ({ error: null, retryKey: s.retryKey + 1, attempts: s.attempts + 1 }));
      }, 250);
      return;
    }
    // Último recurso: una sola recarga automática, sin pantalla de error ni botones.
    try {
      const reloads = Number(sessionStorage.getItem("autopilot_auto_reload") || "0");
      if (reloads < 1) {
        sessionStorage.setItem("autopilot_auto_reload", String(reloads + 1));
        window.setTimeout(() => window.location.reload(), 400);
      }
    } catch {
      /* sin sessionStorage no reintentamos */
    }
  }


  componentWillUnmount() {
    if (this.timer) window.clearTimeout(this.timer);
  }

  render() {
    if (this.state.error) {
      // Recuperación silenciosa: solo un indicador de carga, sin mensajes de error.
      return (
        <main className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Cargando</span>
        </main>
      );
    }

    return <div key={this.state.retryKey} className="contents">{this.props.children}</div>;
  }
}
