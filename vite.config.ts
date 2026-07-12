import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// PWA: precache app-shell (Workbox generateSW), autoUpdate.
// Data hidup di IndexedDB (Dexie), BUKAN di cache service worker —
// jadi kita tidak meng-cache respons API Supabase (hindari data basi).
export default defineConfig({
  base: process.env.BASE_URL ?? "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "SJB POS — Toko Bangunan & Toserba",
        short_name: "SJB POS",
        description: "Aplikasi kasir & stok, jalan offline.",
        lang: "id-ID",
        theme_color: "#1f5f8b",
        background_color: "#f4f2ee",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",
        icons: [
          { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        // Jangan cache panggilan Supabase — biarkan sync engine yang urus data.
        navigateFallbackDenylist: [/^\/api/, /supabase/],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
