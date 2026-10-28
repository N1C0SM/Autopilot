/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** JSON of the public plan catalog captured at build time (see vite.config.ts). */
  readonly VITE_PLAN_SNAPSHOT?: string;
}
