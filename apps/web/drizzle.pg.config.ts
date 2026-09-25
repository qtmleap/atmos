import { defineConfig } from 'drizzle-kit'

// Generates flat `NNNN_name.sql` files into src/db/pg/migrations/, applied by
// migratePg (src/db/pg/client.ts) via drizzle-orm/postgres-js/migrator. This
// is the PostgreSQL counterpart of drizzle.config.ts (D1); the Cloudflare
// path is unaffected by this file.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/pg/schema.ts',
  out: './src/db/pg/migrations',
})
