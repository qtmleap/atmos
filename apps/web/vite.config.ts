import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import mockDiff from '@qtmleap/vite-plugin-mock-diff'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { intlayer } from 'vite-intlayer'
import { VitePWA } from 'vite-plugin-pwa'
import atmosDevFixtures from './dev/fixtures/plugin'

export default defineConfig({
  server: {
    port: 12155,
  },
  plugins: [
    // mock-diff viewer (compose sidecar on 12355), opened at /mock-diff.
    // `enforce: 'pre'` puts its middleware ahead of cloudflare()'s, which
    // otherwise answers every /api request before this ever saw it.
    mockDiff(),
    // Dev-only fixture API: answers /api/* with the data the mocks draw, since
    // the Worker needs Cloudflare Access and a filled D1 (dev/fixtures/plugin.ts).
    // ATMOS_DEV_API=real sends /api to the Worker instead.
    atmosDevFixtures(),
    // File-based routes under src/app/routes; the generated tree is committed
    // because `bun test` and `tsc` run without Vite. Must come before react().
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    // Dictionaries from *.content.ts (intlayer.config.ts). The bundled locale
    // proxy is off there, so no URL is rewritten.
    intlayer(),
    cloudflare({
      configPath: './wrangler.toml',
    }),
    // Minimal PWA (docs/PLAN.md §6): an installable manifest and icons only.
    // The service worker precaches nothing and has no navigation fallback,
    // so every request (including /api and the OGP pages) still reaches the
    // network and Cloudflare Access sees every navigation.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'atmos',
        short_name: 'atmos',
        description: 'atmos experiment tracker',
        lang: 'ja',
        display: 'standalone',
        start_url: '/',
        theme_color: '#171717',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: [],
        navigateFallback: null,
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    target: 'esnext',
    minify: true,
  },
  worker: {
    format: 'es',
  },
  ssr: {
    target: 'webworker',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
