import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API client calls /api/v1/... relative to the page, so the dev server
// forwards /api (and uploaded files) to the backend on port 5002.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5002',
      '/uploads': 'http://localhost:5002',
    },
  },
});
