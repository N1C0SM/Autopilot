import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "@fontsource-variable/inter/opsz.css";
import "./index.css";
import { initNative, initPlatformClasses } from "./lib/native";

// The build prerenders head tags per route (seo/prerender.ts). Helmet takes over from here,
// so drop them to avoid duplicated titles, canonicals or JSON-LD once the app is running.
document.querySelectorAll("head [data-prerender]").forEach((el) => el.remove());

// Before the first render, so app-only behaviour (no text selection, no zoom) never flickers in.
initPlatformClasses();

// Init Capacitor (status bar + splash) sólo si la app corre como nativa.
initNative();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
