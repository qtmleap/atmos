// Bindings that wrangler.toml does not declare, so `wrangler types` leaves them
// out of worker-configuration.d.ts.
interface CloudflareBindings {
  /** Set by vite.config.ts under `vite` (serve) only; see AccessConfig.localEmail. */
  LOCAL_ACCESS_EMAIL?: string
}
