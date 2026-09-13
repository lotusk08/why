import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    assetsDir: 'bundle',
    sourcemap: false,
    modulePreload: { polyfill: false }
  },
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node'
  }
});
