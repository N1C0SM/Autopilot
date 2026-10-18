import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { seoPrerender } from "./seo/prerender";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mcpPlugin(),
    // The inline-styled splash covers the page until React mounts, so the main stylesheet
    // can load without blocking first paint (improves FCP on slow mobile networks).
    {
      name: "non-blocking-css",
      apply: "build" as const,
      enforce: "post" as const,
      transformIndexHtml(html: string) {
        return html.replace(
          /<link rel="stylesheet"(?: crossorigin)? href="(\/assets\/[^"]+\.css)">/g,
          '<link rel="preload" as="style" href="$1" crossorigin><link rel="stylesheet" href="$1" crossorigin media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" href="$1"></noscript>',
        );
      },
    },
    seoPrerender(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react-vendor";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("recharts")) return "charts";
          return undefined;
        },
      },
    },
  },
}));
