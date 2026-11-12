/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built app works on GitHub Pages project URLs
// (https://<user>.github.io/<repo>/) and from the filesystem alike.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    sourcemap: true,
    target: 'es2020'
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
