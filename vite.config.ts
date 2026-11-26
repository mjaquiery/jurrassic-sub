import { defineConfig } from 'vitest/config';
import { serviceWorker } from './build/service-worker';

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
  test: { include: ['tests/**/*.test.ts'] },
});
