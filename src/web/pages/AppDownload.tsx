import PublicLayout from "@/web/components/PublicLayout";
import PageHero from "@/web/components/PageHero";
import AppStoreBadges from "@/web/components/AppStoreBadges";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useApkDownloadEnabled } from "@/shared/lib/apkDownload";
import { Button } from "@/shared/components/ui/button";

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
        <li key={s} className="flex gap-3 type-subhead text-muted-foreground">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 type-caption1 font-semibold text-primary tabular-nums">
            {i + 1}
          </span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );

  const android = (
    <section className="rounded-[28px] bg-card p-6">
      <h2 className="font-rounded type-title2">Android</h2>
      <p className="mt-1 type-subhead text-muted-foreground">Instalación directa, sin Google Play.</p>
      <Button asChild size="lg" className="mt-5 w-full">
        <a href={APK_URL} rel="noopener">Descargar APK</a>
      </Button>
      <Steps items={androidSteps} />
      <p className="mt-5 rounded-media bg-secondary p-4 type-footnote text-muted-foreground">
        ¿Ya la tienes? Para actualizar, descarga de nuevo e instala encima: tus datos se mantienen.
      </p>
    </section>
  );

  return (
    <PublicLayout title="Descargar la app" description="Instala Autopilot en tu móvil: tu plan de entrenamiento y nutrición en la pantalla de inicio.">
      <PageHero eyebrow="App móvil" title="Instala" accent="Autopilot">Tu plan de entrenamiento y nutrición, en tu pantalla de inicio.</PageHero>
      <div className="mx-auto max-w-md space-y-4 px-5 pb-20 sm:px-8">
        <AppStoreBadges />
        {android}
      </div>
    </PublicLayout>
  );
}
