import { defineConfig } from 'drizzle-kit'

// Generates flat `NNNN_name.sql` files into src/db/migrations/, which is also
// the `migrations_dir` of the D1 binding in wrangler.toml. Apply them with
// `wrangler d1 migrations apply DB` (add `--local` for the local database).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
})
