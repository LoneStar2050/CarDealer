/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development, /api requests are proxied to the Express backend,
// so the browser talks to a single origin and no CORS setup is needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Whole-app UI tests take ~0.5 s alone, but files run in parallel and on a busy
    // machine single tests were measured at up to 5.06 s, over the 5 s default.
    testTimeout: 15_000,
  },
});
