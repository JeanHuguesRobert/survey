import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function markdownRedirectPlugin() {
  return {
    name: "markdown-public-redirect",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const accept = req.headers.accept || "";
        if (!accept.includes("text/html")) return next();

        try {
          const fullUrl = new URL(req.url || "", "http://localhost");
          const markdownTarget = resolveMarkdownTarget(fullUrl);
          if (markdownTarget) {
            const fileParam = encodeURIComponent(markdownTarget);
            res.statusCode = 302;
            res.setHeader("Location", `/markdown-viewer?file=${fileParam}`);
            res.end();
            return;
          }
        } catch {
          // ignore malformed URLs
        }
        next();
      });
    },
  };
}

function resolveMarkdownTarget(url) {
  if (!url.pathname.startsWith("/docs/")) return null;
  if (url.searchParams.get("raw") === "1") return null;
  if (!url.pathname.endsWith(".md")) return null;
  return `${url.pathname}${url.search}`;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), markdownRedirectPlugin()],
  optimizeDeps: {
    include: ["remark-gfm"],
  },
  build: {
    sourcemap: true,
    minify: false,
  },
  server: {
    watch: {
      usePolling: false,
      interval: 500,
    },
    hmr: {
      overlay: true,
    },
  },
  css: {
    preprocessorOptions: {
      css: {
        charset: false,
      },
    },
  },
});
