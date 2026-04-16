/**
 * One-shot: dumps every non-deleted skill row to
 * src/lib/ai/skills/<slug>.md. Idempotent — rewrites each file.
 *
 * Usage: npx tsx scripts/dump-skills-to-fs.ts [--dry-run]
 *
 * File format is a minimal YAML frontmatter block followed by the raw
 * content. The resolver parses the frontmatter to discover type/label.
 */
import 'dotenv/config'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

config({ path: '.env.local' })

const OUT_DIR = join(process.cwd(), 'src/lib/ai/skills')

interface Row {
  slug: string
  label: string
  description: string | null
  type: string
  content: string
}

function formatFile(row: Row): string {
  const header = [
    '---',
    `slug: ${row.slug}`,
    `label: ${JSON.stringify(row.label)}`,
    `type: ${row.type}`,
    row.description ? `description: ${JSON.stringify(row.description)}` : null,
    '---',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n')
  return `${header}${row.content.trim()}\n`
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  const sql = postgres(process.env.DATABASE_URL)
  const dryRun = process.argv.includes('--dry-run')

  const rows = await sql<Row[]>`
    SELECT slug, label, description, type, content
    FROM skills
    WHERE deleted_at IS NULL AND enabled = true
    ORDER BY slug
  `

  if (!dryRun) mkdirSync(OUT_DIR, { recursive: true })

  for (const row of rows) {
    const body = formatFile(row)
    const path = join(OUT_DIR, `${row.slug}.md`)
    if (dryRun) {
      console.log(`--- ${path} ---\n${body}`)
    } else {
      writeFileSync(path, body)
      console.log(`✓ ${path} (${body.length} bytes)`)
    }
  }

  console.log(`\nDumped ${rows.length} skill(s)${dryRun ? ' (dry-run)' : ''}.`)
  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
