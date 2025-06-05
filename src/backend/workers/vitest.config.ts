import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      script: '',
      wranglerConfigPath: './wrangler.toml',
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});