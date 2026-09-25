// Routes fetch() calls of a component test to canned JSON responses.
import { mock } from 'bun:test'

const realFetch = globalThis.fetch

export type Route = (url: URL) => unknown

/**
 * Installs a fetch that answers `routes[pathname]` (with `url` for query
 * checks) and 404s everything else. Returns the requested URLs.
 */
export const installFetch = (routes: Record<string, Route>): string[] => {
  const requested: string[] = []
  const fake = mock(async (input: unknown) => {
    const url = new URL(String(input), 'http://localhost/')
    requested.push(`${url.pathname}${url.search}`)
    const route = routes[url.pathname]
    if (route === undefined) {
      return Response.json({ error: { code: 'not_found', message: 'not found' } }, { status: 404 })
    }
    return Response.json(route(url))
  })
  globalThis.fetch = Object.assign(fake, { preconnect: realFetch.preconnect })
  return requested
}

export const restoreFetch = () => {
  globalThis.fetch = realFetch
}
