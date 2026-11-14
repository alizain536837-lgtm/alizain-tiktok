import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Served as a static SPA on Netlify; hash routing is used so no
  // server-side route config is needed beyond the /* -> /index.html fallback.
  server: {
    port: 5173,
    // Dev-only proxy: during local development the admin panel talks to a
    // locally running backend on its own port (http://localhost:4000).
    // Production does NOT use this — it calls the same-site relative /api
    // path, which Netlify redirects to the serverless function.
    proxy: {
      '/api': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
  preview: { port: 4173, host: '127.0.0.1' },
});
