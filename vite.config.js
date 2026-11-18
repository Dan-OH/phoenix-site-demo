import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Every .html file in the project root is its own page.
const pages = Object.fromEntries(
  readdirSync(import.meta.dirname)
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.replace(/\.html$/, ''), resolve(import.meta.dirname, f)])
);

export default defineConfig({
  build: {
    rollupOptions: { input: pages },
    // Keep Vite's hashed output separate from public/assets.
    assetsDir: '_vite',
  },
});
