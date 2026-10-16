import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// El certificado de `make cert` (scripts/dev/local-cert.sh), firmado por una
// autoridad local de confianza. Con él la web se sirve por HTTPS: el enunciado
// no hace excepción con el entorno local. Sin él —quien arranca Vite a mano—
// sigue por HTTP.
const tls = fileURLToPath(new URL('../../config/local-tls/', import.meta.url));
const https =
  existsSync(`${tls}localhost.crt`) && existsSync(`${tls}localhost.key`)
    ? {
        cert: readFileSync(`${tls}localhost.crt`),
        key: readFileSync(`${tls}localhost.key`),
      }
    : undefined;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true, // Necesario para que funcione dentro de Docker.
      port: 5173,
      https,
      proxy: {
        // El navegador llama a /api y Vite lo reenvia al backend sin CORS.
        // `xfwd` le pasa a la API el esquema y el host por los que entró el
        // navegador (X-Forwarded-Proto/Host): con ellos escribe los enlaces de
        // los correos contra la web, por https si la web va por https.
        '/api': {
          target: env.VITE_PROXY_TARGET ?? 'http://localhost:5000',
          changeOrigin: true,
          xfwd: true,
        },
        '/socket.io': {
          target: env.VITE_PROXY_TARGET ?? 'http://localhost:5000',
          changeOrigin: true,
          ws: true,
          xfwd: true,
        },
      },
    },
  };
});
