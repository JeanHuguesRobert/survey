import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,  // ESSENTIEL pour Windows
      interval: 100
    },
    hmr: {
      overlay: true
    }
  }
  