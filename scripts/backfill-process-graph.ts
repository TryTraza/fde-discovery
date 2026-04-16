/**
 * Backfills processModels.graph from the legacy steps/edgeCases/systems columns.
 *
 * Usage:
 *   npx tsx scripts/backfill-process-graph.ts --dry-run
 *   npx tsx scripts/backfill-process-graph.ts
 *
 * Idempotent: rows with a non-null graph are skipped unless --force is passed.
 */
import 'dotenv/config'
import { config } from 'dotenv'
import postgres from 'postgres'
import { buildGraphFromLegacyModel } from '../src/lib/ai/graph/build-graph'
import type { EdgeCase, ProcessStep, SystemEntry } from '../src/lib/db/types'

config({ path: '.env.local' })

interface Row {
  id: string
  process_id: string
  steps: ProcessStep[] | null
  edge_cases: EdgeCase[] | null
  systems: SystemEntry[] | null
  graph: unknown
}

const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force')

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  const sql = postgres(process.env.DATABASE_URL)

  const rows = await sql<Row[]>`
    SELECT id, process_id, steps, edge_cases, systems, graph
    FROM process_models
  `

  let skipped = 0
  let transformed = 0
  let errored = 0

  for (const row of rows) {
    if (row.graph && !force) {
      skipped++
      continue
    }

    try {
      const graph = buildGraphFromLegacyModel({
        steps: row.steps ?? [],
        edgeCases: row.edge_cases ?? [],
        systems: row.systems ?? [],
      })

      if (!dryRun) {
        await sql`
          UPDATE process_models
          SET graph = ${sql.json(graph as never)}, updated_at = now()
          WHERE id = ${row.id}
        `
      }
      transformed++
    } catch (err) {
      errored++
      console.error(`✗ process_model ${row.id} (process ${row.process_id}):`, err)
    }
  }

  console.log(`\nBackfill summary${dryRun ? ' (dry-run)' : ''}:`)
  console.log(`  total rows:  ${rows.length}`)
  console.log(`  transformed: ${transformed}`)
  console.log(`  skipped:     ${skipped}`)
  console.log(`  errored:     ${errored}`)

  await sql.end()
  if (errored > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
