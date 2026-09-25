// StaticAssets (src/api/platform/types.ts) serving STATIC_DIR (vite build's
// dist/client) for the self-hosted server: the Bun equivalent of the ASSETS
// binding on Cloudflare (`not_found_handling = "single-page-application"`,
// wrangler.toml) — a matching file when there is one, index.html otherwise,
// so client-side routes under src/app/routes resolve.
//
// The request path is taken from the URL's already-normalized `pathname`
// (the WHATWG URL parser collapses `.`/`..` segments, including their
// `%2e`-encoded forms, against the root before this ever runs, and it can
// never climb above a leading `/`), then decoded and rebuilt one segment at
// a time so a segment that *decodes* into a `/`, `\`, NUL or a `.`/`..`
// cannot smuggle a new path separator past that normalization — the
// vulnerability double `decodeURIComponent`-ing the whole pathname at once
// would reopen. A request whose path fails to decode, or maps to nothing
// under the root, falls back to index.html like every other SPA route.
import { resolve } from 'node:path'
import type { StaticAssets } from '../api/platform/types'

const ASSETS_PREFIX = '/assets/'
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
const NO_CACHE = 'no-cache'

const decodeSegment = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

const isPathSegment = (segment: string | null): segment is string =>
  segment !== null &&
  segment.length > 0 &&
  segment !== '.' &&
  segment !== '..' &&
  !segment.includes('/') &&
  !segment.includes('\\') &&
  !segment.includes('\0')

/** `pathname`'s filesystem path under `root`, or null when a segment is unsafe once decoded. */
const resolveRequestPath = (root: string, pathname: string): string | null => {
  const segments = pathname.split('/').filter((segment) => segment.length > 0)
  const decoded = segments.map(decodeSegment)
  if (!decoded.every(isPathSegment)) {
    return null
  }
  return resolve(root, ...decoded)
}

export const filesystemAssets = (staticDir: string): StaticAssets => {
  const root = resolve(staticDir)
  const indexPath = resolve(root, 'index.html')

  const indexResponse = (): Response =>
    new Response(Bun.file(indexPath), { headers: { 'Cache-Control': NO_CACHE } })

  return {
    fetch: async (request) => {
      const { pathname } = new URL(request.url)
      const filePath = pathname === '/' ? null : resolveRequestPath(root, pathname)
      if (filePath === null) {
        return indexResponse()
      }
      const file = Bun.file(filePath)
      if (!(await file.exists())) {
        return indexResponse()
      }
      const cacheControl = pathname.startsWith(ASSETS_PREFIX) ? IMMUTABLE_CACHE : NO_CACHE
      return new Response(file, { headers: { 'Cache-Control': cacheControl } })
    },
  }
}
