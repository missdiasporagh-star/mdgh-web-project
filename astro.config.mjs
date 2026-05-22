// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://missdiasporagh.org',
  output: 'server',
  adapter: cloudflare({
    mode: 'advanced'
  }),
  integrations: [
    react(),
    sitemap({
      // Public-only routes. Excludes:
      // - /admin and /api (sensitive, never indexable)
      // - /apply/{return,form,recover,closed,done} (token-gated or status-only)
      // - /mock-checkout (dev/sandbox only)
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/api/') &&
        !page.match(/\/apply\/(return|form|recover|closed|done)/) &&
        !page.includes('/mock-checkout'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});