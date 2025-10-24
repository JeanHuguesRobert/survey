import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['remark-gfm'], // Ajoutez explicitement remark-gfm ici
  },
  build: {
    sourcemap: true,
    minify: false
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      overlay: true,
    },
  },
  css: {
    preprocessorOptions: {
      css: {
        charset: false, // Assurez-vous que les fichiers CSS sont correctement traités
      },
    },
  },
});
