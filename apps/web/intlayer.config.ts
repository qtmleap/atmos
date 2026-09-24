import { type IntlayerConfig, Locales } from 'intlayer'

// Locale handling stays out of the URL: wrangler's `run_worker_first` and the
// Cloudflare Access rules match `/api/*`, `/projects/*` and `/users/*`
// verbatim, so a `/en/projects/...` prefix would bypass both. The locale is
// chosen in the app instead and remembered in a cookie.
const config: IntlayerConfig = {
  internationalization: {
    locales: [Locales.JAPANESE, Locales.ENGLISH],
    defaultLocale: Locales.JAPANESE,
  },
  routing: {
    mode: 'no-prefix',
    enableProxy: false,
    storage: 'cookie',
  },
  content: {
    contentDir: ['src/app'],
    // Only `*.content.{ts,tsx}` are dictionaries; the route files under
    // src/app/routes must never be picked up as content.
    fileExtensions: ['.content.ts', '.content.tsx'],
  },
  editor: {
    enabled: false,
  },
}

export default config
