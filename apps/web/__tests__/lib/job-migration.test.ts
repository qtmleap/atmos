import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(import.meta.dir, '../../src/db/migrations/0003_curly_mentor.sql'),
  'utf8',
)

test('activity migration preserves existing jobs in a populated database', () => {
  const db = new Database(':memory:')
  try {
    db.exec('CREATE TABLE jobs (id text PRIMARY KEY NOT NULL)')
    db.exec("INSERT INTO jobs (id) VALUES ('existing')")
    for (const statement of migration.split('--> statement-breakpoint')) {
      db.exec(statement)
    }
    const row = db.query('SELECT last_activity_at FROM jobs WHERE id = ?').get('existing')
    expect(row).toHaveProperty('last_activity_at')
    expect(Number(db.query('SELECT last_activity_at FROM jobs').values()[0]?.[0])).toBeGreaterThan(
      0,
    )
  } finally {
    db.close()
  }
})
