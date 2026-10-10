import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
const currentBuildFiles = new Set<string>();
export default defineConfig({
  plugins: [react(), {
    name: "track-current-build-files",
    generateBundle(_options, bundle) {
      currentBuildFiles.clear();
      Object.keys(bundle).forEach(file => currentBuildFiles.add(file));
    },
  }, VitePWA({
    registerType: "prompt",
    includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
    manifest: {
      id: "/", name: "Kütüphanem", short_name: "Kütüphanem", lang: "tr", description: "Kitaplarını, filmlerini ve okuma hedeflerini takip et.",
      start_url: "/library", scope: "/", display: "standalone", background_color: "#fffaf3", theme_color: "#ea580c",
      icons: [
        {src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any"},
        {src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any"},
        {src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable"},
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api\//, /^\/__/],
      cleanupOutdatedCaches: true,
      manifestTransforms: [async entries => ({
        manifest: entries.filter(entry => currentBuildFiles.has(entry.url) || entry.url === "index.html" || entry.url === "manifest.webmanifest" || entry.url.startsWith("icons/")),
        warnings: [],
      })],
      // Only the application shell is cached. API and Firebase responses stay on the network.
      runtimeCaching: [],
    },
  })],
  build: { outDir: "build", emptyOutDir: true, rollupOptions: { output: { manualChunks: { charts: ["recharts"], pdf: ["jspdf", "html2canvas"] } } } },
});
