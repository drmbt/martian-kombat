/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // honor a harness-assigned port (e.g. Claude preview); default stays 5173
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
