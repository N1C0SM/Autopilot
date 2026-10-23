import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useApkDownloadEnabled } from "@/lib/apkDownload";
import { Button } from "@/components/ui/button";
import logo from "@/assets/autopilot-logo.png";

// APK publicado automáticamente por GitHub Actions (deploy-android.yml) en la release "android-latest".
export const APK_URL = "https://github.com/N1C0SM/Autopilot/releases/download/android-latest/autopilot.apk";

const androidSteps = [
  "Pulsa «Descargar APK» desde tu móvil Android.",
  "Abre el archivo descargado desde las notificaciones o la carpeta Descargas.",
  "Si Android lo pide, pulsa Ajustes y activa «Permitir desde esta fuente».",
  "Vuelve atrás, pulsa Instalar y después Abrir.",
  "Si aparece «Google Play Protect», pulsa «Más detalles» y luego «Instalar de todas formas». Si no sale esa opción, abre Play Store → tu foto → Play Protect → ⚙️ y desactiva «Analizar apps» mientras instalas.",
];


export default function AppDownload() {
  const [enabled] = useApkDownloadEnabled();

  useEffect(() => {
    document.title = "Descargar la app · Autopilot";
  }, []);

  if (enabled === false) return <Navigate to="/" replace />;
  if (enabled === null) return <main className="min-h-screen bg-background" />;

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
      <Button asChild size="lg" className="mt-5 w-full rounded-2xl">
        <a href={APK_URL} rel="noopener">Descargar APK</a>
      </Button>
      <Steps items={androidSteps} />
      <p className="mt-5 rounded-2xl border border-border bg-background/60 p-4 text-xs text-muted-foreground">
        ¿Ya la tienes? Para actualizar, descarga de nuevo e instala encima: tus datos se mantienen.
      </p>
    </section>
  );

  return (
    <main className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="text-sm text-primary">‹ Inicio</Link>
        <div className="mt-8 flex flex-col items-center text-center">
          <img src={logo} alt="Autopilot" className="h-16 w-16 rounded-2xl" />
          <h1 className="mt-5 type-display-sm text-foreground">Instala Autopilot</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tu plan de entrenamiento y nutrición, en tu pantalla de inicio.</p>
        </div>
        <div className="mt-8 space-y-4">
          {android}
        </div>
      </div>
    </main>
  );
}
