import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.aa0029da00154c05a2b503e61df0f87c",
  appName: "autopilotv2",
  webDir: "dist",
  server: {
    url: "https://aa0029da-0015-4c05-a2b5-03e61df0f87c.lovableproject.com/?forceHideBadge=true&native=1",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#090909",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#090909",
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
    },
  },
};

export default config;