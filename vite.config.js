import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const htmlInjectionPlugin = (env) => {
  return {
    name: "html-injection",
    transformIndexHtml(html) {
      const appId = env.VITE_FACEBOOK_APP_ID || process.env.VITE_FACEBOOK_APP_ID;
      return html.replace(/%VITE_FACEBOOK_APP_ID%/g, appId || "");
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(), // ← Add this
      htmlInjectionPlugin(env),
    ],
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
  };
});
