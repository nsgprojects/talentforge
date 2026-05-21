import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://158.69.165.245:5000',//'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
