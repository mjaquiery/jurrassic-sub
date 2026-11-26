import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { serviceWorker } from './build/service-worker';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [serviceWorker()],
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
  test: { include: ['tests/**/*.test.ts'] },
});
