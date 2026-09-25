// Self-hosted server entry point (Bun + PostgreSQL + a local directory),
// bundled by the Dockerfile with `bun build src/server/index.ts
// --target=bun --conditions=postgres` and run as the image's CMD; the
// Cloudflare Workers equivalent is src/api/index.ts (not touched here).
//
// Startup: parse config (config.ts) -> apply pending migrations
// (migratePg) -> open the PostgreSQL connection (createPgDatabase) ->
// assemble the Platform (platform.ts) -> Bun.serve, routing every request
// through the same `app` every route file shares (src/api/app.ts) with the
// live hub's WebSocket handlers wired in (live-hub.ts). SIGTERM/SIGINT stop
// accepting new connections, wait for in-flight `waitUntil` work, then close
// the database connection.
import { app } from '../api/app'
import { createPgDatabase, migratePg } from '../db/pg/client'
import { loadServerConfig } from './config'
import { createLiveHub } from './live-hub'
import { createServerPlatform } from './platform'

const config = loadServerConfig()

await migratePg(config.databaseUrl)

const pg = createPgDatabase(config.databaseUrl)
const live = createLiveHub()
const platform = createServerPlatform(config, pg, live)

const server = Bun.serve({
  port: config.port,
  fetch: (request) => app.fetch(request, { PLATFORM: platform }),
  websocket: live.websocket,
})
// Nothing yields to the event loop between Bun.serve() returning and this
// call, so no request can reach live.connect() before the hub can upgrade it.
live.attach(server)

console.log(`atmos listening on http://localhost:${server.port}`)

const shutdownState = { started: false }

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shutdownState.started) {
    return
  }
  shutdownState.started = true
  console.log(`${signal} received, shutting down`)
  await server.stop()
  await platform.drain()
  await pg.close()
  process.exit(0)
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      console.error('error during shutdown', error)
      process.exit(1)
    })
  })
}
