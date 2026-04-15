/**
 * Seed script for skills table.
 * Run: npx tsx scripts/seed-skills.ts
 * Idempotent: skips if slug already exists.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, isNull } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

interface SkillSeed {
  slug: string;
  label: string;
  description: string;
  type: 'system-prompt' | 'context-enrichment' | 'instruction';
  content: string;
}

const SKILLS: SkillSeed[] = [
  {
    slug: 'process-archaeology',
    label: 'Process Archaeology',
    description: 'Domain knowledge for analyzing legacy and undocumented processes. Injected as system prompt context.',
    type: 'system-prompt',
    content: `You are helping an FDE (Field Discovery Engineer) uncover how work actually happens — not how it's documented.

Key principles:
- Operators often describe the ideal process, not the actual one. Probe for "what really happens when..."
- Look for workarounds: spreadsheets, sticky notes, email chains, personal checklists — these are the real process.
- Every manual step is a candidate for automation, but not every manual step should be automated.
- Systems of record often lag behind actual practice. The ERP says one thing; the operator does another.
- When mapping, capture WHO does each step — role matters more than name.
- Pay special attention to handoff points between people or systems — this is where processes break down.
- "It depends" is the most important answer — it means there's an edge case or decision point worth mapping.`,
  },
];

async function seed() {
  for (const skill of SKILLS) {
    const existing = await db
      .select()
      .from(schema.skills)
      .where(and(eq(schema.skills.slug, skill.slug), isNull(schema.skills.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.skills).values(skill);
      console.log(`  Created: ${skill.slug}`);
    } else {
      console.log(`  Skipped (exists): ${skill.slug}`);
    }
  }

  console.log(`\nSeeded ${SKILLS.length} skills.`);
  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
