import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // 5 s se queda corto con los 23 ficheros corriendo en paralelo en jsdom:
    // algún render pesado superaba el límite por carga, no por lógica. Limitamos
    // también los workers para que el resultado sea repetible.
    testTimeout: 20000,
    hookTimeout: 20000,
    maxWorkers: 2,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
