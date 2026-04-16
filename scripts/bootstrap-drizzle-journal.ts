/**
 * One-time bootstrap: seeds drizzle.__drizzle_migrations with entries for
 * migrations that were previously applied via `db:push` (0000-0002).
 *
 * After this runs once, `drizzle-kit migrate` becomes the source of truth
 * and will only apply new migrations (0003+).
 *
 * Safe to re-run: inserts are skipped for hashes already present.
 */
import 'dotenv/config'
import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

config({ path: '.env.local' })

const PREVIOUSLY_APPLIED = ['0000_woozy_mesmero', '0001_lonely_clea', '0002_premium_spencer_smythe']
const MIGRATIONS_DIR = join(process.cwd(), 'src/lib/db/migrations')

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  const sql = postgres(process.env.DATABASE_URL)

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `

  const existing =
    await sql<{ hash: string }[]>`SELECT hash FROM drizzle.__drizzle_migrations`
  const existingHashes = new Set(existing.map((r) => r.hash))

  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8')
  ) as { entries: { tag: string; when: number }[] }

  for (const tag of PREVIOUSLY_APPLIED) {
    const entry = journal.entries.find((e) => e.tag === tag)
    if (!entry) throw new Error(`Journal entry for ${tag} not found`)
    const sqlBody = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8')
    const hash = createHash('sha256').update(sqlBody).digest('hex')
    if (existingHashes.has(hash)) {
      console.log(`• ${tag} already recorded — skipping`)
      continue
    }
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `
    console.log(`✓ ${tag} recorded as applied`)
  }

  const final = await sql<{ hash: string; created_at: string }[]>`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id
  `
  console.log(`\nMigrations table now contains ${final.length} entries.`)
  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
