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
      // /admin and /api never need to be in the sitemap. /apply/* (apart from
      // the entry page) is also gated on tokens, so exclude its inner routes.
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/api/') &&
        !page.includes('/apply/return') &&
        !page.includes('/apply/form') &&
        !page.includes('/apply/recover'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});