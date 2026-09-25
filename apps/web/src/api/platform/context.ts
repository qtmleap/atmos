// The Hono env every route and middleware uses, and the one way to reach the
// platform from a handler: `const platform = getPlatform(c)`.
//
// The Bun server passes its platform in as the `PLATFORM` binding
// (`app.fetch(request, { PLATFORM })`); on Workers there is none and the
// platform is built from the Worker's bindings. Either way it is built once
// per request and kept in `c.var.platform`.
import type { Context } from 'hono'
import { cloudflarePlatform } from './cloudflare'
import type { Platform } from './types'

export type AppEnv = {
  Bindings: CloudflareBindings & { PLATFORM?: Platform }
  Variables: { platform: Platform }
}

export const getPlatform = (c: Context<AppEnv>): Platform => {
  const cached: Platform | undefined = c.get('platform')
  if (cached !== undefined) {
    return cached
  }
  const given = c.env.PLATFORM
  const platform = given === undefined ? cloudflarePlatform(c.env, c.executionCtx) : given
  c.set('platform', platform)
  return platform
}
