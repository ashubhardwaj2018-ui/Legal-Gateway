import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// PORT and BASE_PATH are required at runtime (dev/preview server) but default
// gracefully during a static production build (vite build) where server config
// is irrelevant.
const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — always needed, load first
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/")) {
            return "vendor-react";
          }
          // TipTap editor — only on /admin/page-editor
          if (id.includes("node_modules/@tiptap/") || id.includes("node_modules/prosemirror-")) {
            return "vendor-tiptap";
          }
          // Recharts / chart libraries
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-") || id.includes("node_modules/victory-")) {
            return "vendor-charts";
          }
          // Radix UI primitives (shared across admin + public)
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // Tanstack Query
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }
          // DnD Kit
          if (id.includes("node_modules/@dnd-kit/")) {
            return "vendor-dnd";
          }
          // Framer Motion — heavy animation library
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-framer";
          }
          // Lucide icons — large icon set
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          // XLSX — spreadsheet library, admin-only
          if (id.includes("node_modules/xlsx/")) {
            return "vendor-xlsx";
          }
          // date-fns — date utility library
          if (id.includes("node_modules/date-fns")) {
            return "vendor-dates";
          }
          // Zod + react-hook-form — form validation
          if (id.includes("node_modules/zod/") || id.includes("node_modules/react-hook-form/") || id.includes("node_modules/@hookform/")) {
            return "vendor-forms";
          }
          // Embla carousel
          if (id.includes("node_modules/embla-carousel")) {
            return "vendor-carousel";
          }
          // Other node_modules
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
