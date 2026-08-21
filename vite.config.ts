import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo at /pixelpalace/, not the domain root —
  // only applies to production builds so `npm run dev` is unaffected.
  base: command === 'build' ? '/pixelpalace/' : '/',
  server: {
    host: true,
  },
}));
