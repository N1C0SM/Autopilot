import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  retryKey: number;
  attempts: number;
  reloading: boolean;
}

const MAX_AUTO_RETRIES = 3;

/**
 * Captura errores de render y se recupera sola: reintenta el render en silencio
 * en lugar de mostrar una pantalla de error al usuario.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0, attempts: 0, reloading: false };
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
        this.setState({ reloading: true });
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
      // Mientras quedan reintentos automáticos, solo el indicador de carga.
      if (this.state.attempts < MAX_AUTO_RETRIES || this.state.reloading) {
        return (
          <main className="flex h-dvh items-center justify-center bg-background">
            <Spinner size="lg" />
          </main>
        );
      }
      return (
        <main
          className="flex h-dvh items-center justify-center bg-background px-4"
          style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
        >
          <EmptyState
            icon={CloudOff}
            title="Algo no ha cargado bien"
            description="Vuelve a intentarlo. Tus datos están a salvo."
            action={
              <Button variant="plain" size="lg" onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            }
          />
        </main>
      );
    }

    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
  }
}
