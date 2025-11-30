import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const htmlInjectionPlugin = () => {
  return {
    name: "html-injection",
    transformIndexHtml(html) {
      // Access process.env directly during transform (for Netlify builds)
      const appId = process.env.VITE_FACEBOOK_APP_ID || "";
      return html.replace(/%VITE_FACEBOOK_APP_ID%/g, appId);
    },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), htmlInjectionPlugin()],
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
