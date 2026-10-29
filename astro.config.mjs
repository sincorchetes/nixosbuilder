import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';

// En GitHub Pages el sitio vive en https://<usuario>/<repositorio>/.
// El workflow define SITE y BASE; en local se sirve desde la raíz.
export default defineConfig({
  site: process.env.SITE,
  base: process.env.BASE ?? '/',
  integrations: [svelte()],
});
