// Worker entry point (wrangler.toml `main`).
import { app } from './app'

// Durable Object classes must be exported from the entry module.
export { JobLive } from './durable-objects/job-live'

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>
