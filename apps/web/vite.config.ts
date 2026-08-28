import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: true, // Necesario para que funcione dentro de Docker.
      port: 5173,
      proxy: {
        // El navegador llama a /api y Vite lo reenvia al backend sin CORS.
        '/api': {
          target: env.VITE_PROXY_TARGET ?? 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
