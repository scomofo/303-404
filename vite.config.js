import { defineConfig } from 'vite';

// Optional development preview; production remains a plain static site.
export default defineConfig({
  appType: 'mpa',
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
});
