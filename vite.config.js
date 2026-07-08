import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Crucial for Electron to find built files in dist/
  worker: {
    format: 'iife', // classic worker — lebih reliable di Electron file:// (Monaco workers)
  },
  build: {
    chunkSizeWarningLimit: 4000, // Monaco gede, wajar
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
