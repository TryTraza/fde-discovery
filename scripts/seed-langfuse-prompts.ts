/**
 * Seed Langfuse prompts.
 * Run: npx tsx scripts/seed-langfuse-prompts.ts
 * Idempotent: creates new version if prompt exists.
 * Requires: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY in .env
 */
import 'dotenv/config';
import { Langfuse } from 'langfuse';
import { PROMPTS } from '../src/lib/ai/prompts/fixtures';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
});

async function seed() {
  console.log('Seeding Langfuse prompts...\n');

  for (const p of PROMPTS) {
    console.log(`  Creating prompt: ${p.name}`);
    await langfuse.createPrompt({
      name: p.name,
      type: p.type,
      prompt: p.prompt,
      labels: ['production'],
    });
  }

  console.log(`\nSeeded ${PROMPTS.length} prompts to Langfuse.`);
  await langfuse.flushAsync();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
