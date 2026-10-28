import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { seoPrerender } from "./seo/prerender";

// `.env` is not tracked in git, so a fresh clone (e.g. the Mac building the iPhone app)
// would ship a bundle without the backend URL: the app crashes before rendering and the
// native splash stays black. These are public (publishable) values, safe in the bundle.
const PUBLIC_ENV_DEFAULTS: Record<string, string> = {
  VITE_SUPABASE_URL: "https://enebrcdrdnfkyduzyrzm.supabase.co",
  VITE_SUPABASE_PROJECT_ID: "enebrcdrdnfkyduzyrzm",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuZWJyY2RyZG5ma3lkdXp5cnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODIzMjksImV4cCI6MjA4ODU1ODMyOX0.X-E8IIiL4hxkAeE4immBPbcAbi25LuW8yYT0xzWqovU",
};
for (const [key, value] of Object.entries(PUBLIC_ENV_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}

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
    // La entrada del MCP vive en src/shared/lib/mcp tras reorganizar src.
    mcpPlugin({ mcpEntry: "src/shared/lib/mcp/index.ts" }),
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
    // Lazy chunks load their own deps on demand; injecting preload links at runtime made Safari warn about unused preloads.
    modulePreload: { resolveDependencies: (_file: string, deps: string[], ctx: { hostType: string }) => (ctx.hostType === "html" ? deps : []) },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-is|react-router|react-router-dom|scheduler|use-sync-external-store)[\\/]/.test(id)) return "react-vendor";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "supabase";
          return undefined;
        },
      },
    },
  },
}));
