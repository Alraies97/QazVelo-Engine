import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";


// ── Port & base path ──────────────────────────────────────────────────────────
// PORT and BASE_PATH are optional; sensible defaults make local Cursor dev work
// with a plain `pnpm dev` (no env vars needed).
const port = Number(process.env.PORT ?? "5000");
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// ── Backend origin for the Vite dev-server proxy ─────────────────────────────
// BACKEND_URL is the FastAPI origin (not /api/v1 — just the host+port).
// In Docker: set BACKEND_URL=http://backend:8000
// Locally:   defaults to http://localhost:8000
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),

  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "src", "assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api/v1": {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
