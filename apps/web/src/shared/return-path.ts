// Where the login entry (`GET /api/me/login?redirect=<path>`, docs/SPEC.md §4)
// sends the visitor back to. Only a path on this site may be returned to, or
// the entry would be an open redirect: anyone could mail a link that logs in
// on this site and then lands on theirs.

const FALLBACK = '/'

// Only the origin of this base matters: a target that resolves anywhere else
// is rejected. `.invalid` can never be a real host.
const BASE = 'https://return-path.invalid'

/**
 * `raw` as a same-site path plus query (`/projects/a?tab=logs`), or "/" when it
 * is missing or points anywhere else. The result is rebuilt from the parsed
 * URL rather than echoed: URL parsers drop tabs and newlines and read `\` as
 * `/`, so `/\\evil.example` and `/<TAB>/evil.example` both mean `//evil.example`,
 * which a plain `startsWith('//')` check would have let through. The fragment
 * is dropped because the server never receives one.
 */
export const safeReturnPath = (raw: string | null | undefined): string => {
  if (raw === null || raw === undefined || !raw.startsWith('/')) {
    return FALLBACK
  }
  try {
    const url = new URL(raw, BASE)
    return url.origin === BASE ? `${url.pathname}${url.search}` : FALLBACK
  } catch {
    return FALLBACK
  }
}
