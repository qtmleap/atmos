// Dev-server-only fixture API.
//
// Why: under `vite` every /api request goes to the Worker through
// @cloudflare/vite-plugin, and there it needs a Cloudflare Access identity and
// a populated D1. Locally neither exists, so every page stops at "sign in
// required" and the mock-diff viewer (docs/mock-diff) has nothing to compare
// against the mocks. This plugin answers /api/* itself with the data the
// mock HTML under docs/mock-diff/designs/ draws, one module per resource
// (me, projects, jobs, job-detail, users, settings, admin, setup; routing in
// index.ts).
//
// How it is wired: `apply: 'serve'` keeps it out of builds; `enforce: 'pre'`
// plus being listed before cloudflare() in vite.config.ts puts its middleware
// ahead of the Worker's, the same arrangement @qtmleap/vite-plugin-mock-diff
// uses. The live channel (.../live, a WebSocket) is accepted here and then
// left silent, so a running job shows as connected instead of reconnecting.
//
// Switching:
//   - On by default. `ATMOS_DEV_API=real bun run dev` turns it off and lets
//     /api reach the real Worker again.
//   - States: a page navigation (Accept: text/html) with `?scenario=<name>`
//     stores the name in the `atmos-fixture-scenario` cookie; a navigation
//     without it clears the cookie. Handlers branch on that cookie. Used
//     today: /setup?scenario=closed (setup already done).
//
// Nothing is stored: writes answer as the real API would, and the next read
// returns the fixture again.
import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Plugin } from 'vite'
import { handleFixtureRequest, matchPath } from './index'
import { isLiveJob } from './job-detail'

export const SCENARIO_COOKIE = 'atmos-fixture-scenario'
const SCENARIO_PATTERN = /^[a-z0-9-]{1,32}$/
const LIVE_PATTERN = '/api/projects/:project_id/jobs/:job_id/live'
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

const readCookie = (header: string | undefined, name: string): string | null => {
  if (header === undefined) {
    return null
  }
  const pair = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  return pair === undefined ? null : decodeURIComponent(pair.slice(name.length + 1))
}

const requestUrl = (req: IncomingMessage): URL =>
  new URL(req.url === undefined ? '/' : req.url, 'http://fixture.local')

const readScenario = (req: IncomingMessage): string | null => {
  const value = readCookie(req.headers.cookie, SCENARIO_COOKIE)
  return value !== null && SCENARIO_PATTERN.test(value) ? value : null
}

const refererPath = (req: IncomingMessage): string | null => {
  const referer = req.headers.referer
  if (referer === undefined) {
    return null
  }
  try {
    return new URL(referer).pathname
  } catch {
    return null
  }
}

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf8')
}

const parseJson = (text: string): unknown => {
  if (text === '') {
    return undefined
  }
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** A page navigation (not a fetch, not an asset): the browser asked for HTML. */
const isNavigation = (req: IncomingMessage): boolean =>
  req.method === 'GET' &&
  typeof req.headers.accept === 'string' &&
  req.headers.accept.includes('text/html')

/** Remembers `?scenario=` of a page navigation in a cookie, or clears it. */
const applyScenarioCookie = (req: IncomingMessage, res: ServerResponse): void => {
  const scenario = requestUrl(req).searchParams.get('scenario')
  const cookie =
    scenario !== null && SCENARIO_PATTERN.test(scenario)
      ? `${SCENARIO_COOKIE}=${scenario}; Path=/; SameSite=Lax`
      : `${SCENARIO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  res.appendHeader('Set-Cookie', cookie)
}

const answerApi = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const body = await readBody(req)
  const response = await handleFixtureRequest({
    method: req.method === undefined ? 'GET' : req.method,
    url: requestUrl(req),
    scenario: readScenario(req),
    pagePath: refererPath(req),
    json: async () => parseJson(body),
  })
  res.writeHead(response.status, { 'x-atmos-fixture': '1', ...response.headers })
  res.end(req.method === 'HEAD' || response.body === null ? undefined : response.body)
}

/**
 * Completes the WebSocket handshake for a running fixture job and then says
 * nothing; whatever the client sends (its close frame when leaving) ends it.
 */
const acceptSilentSocket = (req: IncomingMessage, socket: Duplex): void => {
  const key = req.headers['sec-websocket-key']
  if (typeof key !== 'string') {
    socket.destroy()
    return
  }
  const accept = createHash('sha1').update(`${key}${WEBSOCKET_GUID}`).digest('base64')
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'),
  )
  socket.on('data', () => socket.end())
  socket.on('error', () => socket.destroy())
}

export default function atmosDevFixtures(): Plugin {
  const enabled = process.env.ATMOS_DEV_API !== 'real'
  return {
    name: 'atmos-dev-fixtures',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      if (!enabled) {
        server.config.logger.info('[atmos-dev-fixtures] off (ATMOS_DEV_API=real)')
        return
      }
      server.config.logger.info('[atmos-dev-fixtures] answering /api/* from dev/fixtures')

      // The Worker's own upgrade listener (cloudflare()) would forward the
      // live socket to miniflare, which refuses it without Access. Marking the
      // request with a `vite-` protocol makes that listener step aside (it
      // leaves Vite's sockets alone), and Vite's HMR only takes `vite-hmr`.
      server.httpServer?.prependListener('upgrade', (req: IncomingMessage, socket: Duplex) => {
        const url = requestUrl(req)
        const params = matchPath(LIVE_PATTERN, url.pathname)
        if (params === null) {
          return
        }
        req.headers['sec-websocket-protocol'] = 'vite-atmos-fixture-live'
        if (isLiveJob(String(params.project_id), String(params.job_id))) {
          acceptSilentSocket(req, socket)
        } else {
          socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
        }
      })

      server.middlewares.use((req, res, next) => {
        const pathname = requestUrl(req).pathname
        if (pathname === '/api' || pathname.startsWith('/api/')) {
          answerApi(req, res).catch((error: unknown) => {
            server.config.logger.error(`[atmos-dev-fixtures] ${String(error)}`)
            if (!res.headersSent) {
              res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
            }
            res.end(JSON.stringify({ error: { code: 'internal_error', message: String(error) } }))
          })
          return
        }
        if (isNavigation(req)) {
          applyScenarioCookie(req, res)
        }
        next()
      })
    },
  }
}
