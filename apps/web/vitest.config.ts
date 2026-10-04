import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Unit and component tests of the web client. They live in `test/`, outside
 * `src`, like the API's: the application build never sees them.
 *
 * jsdom stands in for the browser; `fetch` is replaced per test by
 * `test/support/api.ts`, so every screen runs its real API client against
 * answers whose shape is checked against the API's OpenAPI document.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    css: false,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
