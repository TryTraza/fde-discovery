/**
 * One-shot: removes publicMetadata.aiModels from every Clerk user.
 *
 * Model selection moved to code (src/lib/ai/features/<slug>.ts) in
 * Phase 2.5. Existing per-user overrides are now dead weight — purge
 * them so public metadata reflects reality.
 *
 * Usage: npx tsx scripts/purge-clerk-ai-models.ts [--dry-run]
 *
 * Idempotent: users without an aiModels field are skipped.
 */
import 'dotenv/config'
import { config } from 'dotenv'
import { createClerkClient } from '@clerk/backend'

config({ path: '.env.local' })

async function main() {
  if (!process.env.CLERK_SECRET_KEY) throw new Error('CLERK_SECRET_KEY not set')
  const dryRun = process.argv.includes('--dry-run')
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

  const PAGE = 100
  let offset = 0
  let totalSeen = 0
  let totalPurged = 0

  while (true) {
    const { data: users, totalCount } = await clerk.users.getUserList({
      limit: PAGE,
      offset,
    })

    for (const user of users) {
      totalSeen++
      const meta = user.publicMetadata as Record<string, unknown>
      if (!meta || !('aiModels' in meta)) continue

      if (dryRun) {
        console.log(`• ${user.id} (${user.emailAddresses[0]?.emailAddress}) — would purge`)
        totalPurged++
        continue
      }

      // Clerk's PATCH semantics: setting a key to undefined in publicMetadata
      // requires passing the full map without that key. We rebuild the public
      // metadata map from what's left.
      const rest = Object.fromEntries(
        Object.entries(meta).filter(([k]) => k !== 'aiModels')
      )
      await clerk.users.updateUserMetadata(user.id, { publicMetadata: rest })
      console.log(`✓ ${user.id} — aiModels purged`)
      totalPurged++
    }

    if (users.length < PAGE) break
    offset += PAGE
    if (offset > totalCount) break
  }

  console.log(
    `\nPurge summary${dryRun ? ' (dry-run)' : ''}: ${totalPurged}/${totalSeen} user(s) had aiModels${dryRun ? ' (would purge)' : ' (purged)'}.`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
