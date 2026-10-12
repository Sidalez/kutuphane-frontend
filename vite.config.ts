import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import {execSync} from 'node:child_process';
const buildSha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||(()=>{try{return execSync('git rev-parse HEAD',{encoding:'utf8'}).trim()}catch{return 'local'}})();
const currentBuildFiles = new Set<string>();
export default defineConfig({
  define:{__BUILD_SHA__:JSON.stringify(buildSha.slice(0,7))},
  plugins: [react(), {
    name: "track-current-build-files",
    generateBundle(_options, bundle) {
      this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({commit:buildSha.slice(0,7),builtAt:new Date().toISOString()})});
      currentBuildFiles.clear();
      Object.keys(bundle).forEach(file => currentBuildFiles.add(file));
    },
  }, VitePWA({
    registerType: "prompt",
    includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
    manifest: {
      id: "/", name: "Kütüphanem", short_name: "Kütüphanem", lang: "tr", description: "Kitaplarını, filmlerini ve okuma hedeflerini takip et.",
      start_url: "/today", scope: "/", display: "standalone", background_color: "#fffaf3", theme_color: "#fffaf3",
      icons: [
        {src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any"},
        {src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any"},
        {src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable"},
      ],
    },
    workbox: {
      importScripts: ["/push-sw.js"],
      globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api\//, /^\/__/],
      cleanupOutdatedCaches: true,
      manifestTransforms: [async entries => ({
        manifest: entries.filter(entry => currentBuildFiles.has(entry.url) || entry.url === "index.html" || entry.url === "manifest.webmanifest" || entry.url.startsWith("icons/")),
        warnings: [],
      })],
      // The application shell is precached. Firestore manages authenticated data persistence separately.
      runtimeCaching: [],
    },
  })],
  build: { outDir: "build", emptyOutDir: true, rollupOptions: { output: { manualChunks: { charts: ["recharts"], pdf: ["jspdf", "html2canvas"] } } } },
});
