import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/autopilot-logo.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const APK_URL = `${SUPABASE_URL}/storage/v1/object/public/site-assets/downloads/autopilot.apk`;

const androidSteps = [
  "Pulsa «Descargar APK» desde tu móvil Android.",
  "Abre el archivo descargado desde las notificaciones o la carpeta Descargas.",
  "Si Android lo pide, pulsa Ajustes y activa «Permitir desde esta fuente».",
  "Vuelve atrás, pulsa Instalar y después Abrir.",
];

const iosSteps = [
  "Abre autopilotplan.com en Safari.",
  "Pulsa el botón Compartir (cuadrado con flecha hacia arriba).",
  "Elige «Añadir a la pantalla de inicio» y confirma.",
];

export default function AppDownload() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    document.title = "Descargar la app · Autopilot";
    fetch(APK_URL, { method: "HEAD" })
      .then((r) => setAvailable(r.ok))
      .catch(() => setAvailable(false));
  }, []);

  const Steps = ({ items }: { items: string[] }) => (
    <ol className="mt-4 space-y-3">
      {items.map((s, i) => (
        <li key={s} className="flex gap-3 text-sm text-muted-foreground">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary tabular-nums">
            {i + 1}
          </span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );

  const android = (
    <section className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
      <h2 className="text-lg font-semibold text-foreground">Android</h2>
      <p className="mt-1 text-sm text-muted-foreground">Instalación directa, sin Google Play.</p>
      {available ? (
        <Button asChild size="lg" className="mt-5 w-full rounded-2xl">
          <a href={APK_URL} download="autopilot.apk">Descargar APK</a>
        </Button>
      ) : (
        <Button size="lg" disabled className="mt-5 w-full rounded-2xl">
          {available === null ? "Comprobando…" : "Disponible muy pronto"}
        </Button>
      )}
      <Steps items={androidSteps} />
    </section>
  );

  const ios = (
    <section className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
      <h2 className="text-lg font-semibold text-foreground">iPhone</h2>
      <p className="mt-1 text-sm text-muted-foreground">Se instala desde Safari, a pantalla completa.</p>
      <Steps items={iosSteps} />
    </section>
  );

  return (
    <main className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="text-sm text-primary">‹ Inicio</Link>
        <div className="mt-8 flex flex-col items-center text-center">
          <img src={logo} alt="Autopilot" className="h-16 w-16 rounded-2xl" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">Instala Autopilot</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tu plan de entrenamiento y nutrición, en tu pantalla de inicio.</p>
        </div>
        <div className="mt-8 space-y-4">
          {isIOS ? <>{ios}{android}</> : <>{android}{ios}</>}
        </div>
      </div>
    </main>
  );
}
