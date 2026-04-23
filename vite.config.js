import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // listen on 0.0.0.0 — lets phones on your LAN hit the dev server
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
