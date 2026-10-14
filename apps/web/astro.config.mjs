import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({
  site: 'https://castorrise.github.io',
  base: '/gallery/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  publicDir: '../../public',
  server: { host: '127.0.0.1', port: 4321 },
});
