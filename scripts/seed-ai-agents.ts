/**
 * Seed script for ai_agents table.
 * Run: npx tsx scripts/seed-ai-agents.ts
 * Idempotent: uses upsert (insert or update by slug).
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

interface AgentSeed {
  slug: string;
  label: string;
  description: string;
  mode: 'generateObject' | 'generateText' | 'streamText';
  model: 'fast' | 'standard';
  layers: Array<{ layer: string; options?: Record<string, unknown> }>;
  langfusePromptName: string;
  schemaSlug: string | null;
  tools: Array<{ tool: string; options?: Record<string, unknown> }>;
  maxOutputTokens: number;
  skills: string[];
  resilience: { layerTimeout: number; totalTimeout: number; fallbackOnLayerError: boolean };
}

const AGENTS: AgentSeed[] = [
  {
    slug: 'capture-suggestions',
    label: 'Capture Suggestions',
    description: 'Real-time step/edge suggestions during shadowing sessions',
    mode: 'generateObject',
    model: 'fast',
    layers: [
      { layer: 'l1-domain', options: { mode: 'matched' } },
      { layer: 'l3-process', options: { includeModel: true, fields: 'full' } },
      { layer: 'l4-session', options: { events: 'last20', contacts: false, priorSessions: false, debrief: false } },
    ],
    langfusePromptName: 'capture-suggestions',
    schemaSlug: 'capture-suggestions',
    tools: [],
    maxOutputTokens: 500,
    skills: ['process-archaeology'],
    resilience: { layerTimeout: 3000, totalTimeout: 8000, fallbackOnLayerError: true },
  },
  {
    slug: 'company-research',
    label: 'Company Research',
    description: 'Web-search-powered company research and AI summary generation',
    mode: 'generateText',
    model: 'standard',
    layers: [
      { layer: 'l2-client', options: { fields: 'summary' } },
    ],
    langfusePromptName: 'company-research',
    schemaSlug: null,
    tools: [{ tool: 'web-search', options: { maxSteps: 3 } }],
    maxOutputTokens: 2000,
    skills: [],
    resilience: { layerTimeout: 5000, totalTimeout: 30000, fallbackOnLayerError: false },
  },
  {
    slug: 'process-hypothesis',
    label: 'Process Hypothesis',
    description: 'Generates initial process model hypothesis from client and domain context',
    mode: 'generateObject',
    model: 'standard',
    layers: [
      { layer: 'l1-domain', options: { mode: 'all' } },
      { layer: 'l2-client', options: { fields: 'summary' } },
      { layer: 'l3-process', options: { includeModel: false, fields: 'summary' } },
    ],
    langfusePromptName: 'process-hypothesis',
    schemaSlug: 'process-hypothesis',
    tools: [],
    maxOutputTokens: 2000,
    skills: [],
    resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  },
  {
    slug: 'session-interview',
    label: 'Session Interview',
    description: 'Generates adaptive pre-session interview questions',
    mode: 'generateObject',
    model: 'standard',
    layers: [
      { layer: 'l2-client', options: { fields: 'full' } },
      { layer: 'l3-process', options: { includeModel: true, fields: 'full' } },
    ],
    langfusePromptName: 'session-interview',
    schemaSlug: 'session-interview',
    tools: [],
    maxOutputTokens: 1000,
    skills: [],
    resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  },
  {
    slug: 'prep-brief',
    label: 'Prep Brief',
    description: 'Generates pre-session briefing with context, focus areas, and suggested questions',
    mode: 'generateObject',
    model: 'standard',
    layers: [
      { layer: 'l2-client', options: { fields: 'full' } },
      { layer: 'l3-process', options: { includeModel: true, fields: 'full' } },
      { layer: 'l4-session', options: { events: 'none', contacts: true, priorSessions: true, debrief: false } },
    ],
    langfusePromptName: 'prep-brief',
    schemaSlug: 'prep-brief',
    tools: [],
    maxOutputTokens: 2000,
    skills: [],
    resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  },
  {
    slug: 'session-synthesis',
    label: 'Session Synthesis',
    description: 'Post-session synthesis generating process model updates and open questions',
    mode: 'generateObject',
    model: 'standard',
    layers: [
      { layer: 'l2-client', options: { fields: 'full' } },
      { layer: 'l3-process', options: { includeModel: true, fields: 'full' } },
      { layer: 'l4-session', options: { events: 'none', contacts: true, priorSessions: true, debrief: false } },
    ],
    langfusePromptName: 'session-synthesis',
    schemaSlug: 'session-synthesis',
    tools: [],
    maxOutputTokens: 3000,
    skills: [],
    resilience: { layerTimeout: 5000, totalTimeout: 20000, fallbackOnLayerError: false },
  },
  {
    slug: 'shadowing-synthesis',
    label: 'Shadowing Synthesis',
    description: 'Post-shadowing synthesis with event analysis, system aggregation, and process model updates',
    mode: 'generateObject',
    model: 'standard',
    layers: [
      { layer: 'l2-client', options: { fields: 'full' } },
      { layer: 'l3-process', options: { includeModel: true, fields: 'full' } },
      { layer: 'l4-session', options: { events: 'all', contacts: true, priorSessions: false, debrief: true } },
    ],
    langfusePromptName: 'shadowing-synthesis',
    schemaSlug: 'shadowing-synthesis',
    tools: [],
    maxOutputTokens: 3000,
    skills: [],
    resilience: { layerTimeout: 5000, totalTimeout: 20000, fallbackOnLayerError: false },
  },
  {
    slug: 'email-draft',
    label: 'Email Draft',
    description: 'Generates follow-up email drafts after sessions',
    mode: 'generateText',
    model: 'fast',
    layers: [],
    langfusePromptName: 'email-draft',
    schemaSlug: null,
    tools: [],
    maxOutputTokens: 1500,
    skills: [],
    resilience: { layerTimeout: 3000, totalTimeout: 10000, fallbackOnLayerError: true },
  },
  {
    slug: 'research-chat',
    label: 'Research Chat',
    description: 'Streaming research assistant with web search capabilities',
    mode: 'streamText',
    model: 'standard',
    layers: [
      { layer: 'l2-client', options: { fields: 'full' } },
      { layer: 'l3-process', options: { includeModel: false, fields: 'summary' } },
    ],
    langfusePromptName: 'research-chat',
    schemaSlug: null,
    tools: [{ tool: 'web-search', options: { maxSteps: 5 } }],
    maxOutputTokens: 2000,
    skills: [],
    resilience: { layerTimeout: 5000, totalTimeout: 30000, fallbackOnLayerError: true },
  },
];

async function seed() {
  for (const agent of AGENTS) {
    const existing = await db
      .select()
      .from(schema.aiAgents)
      .where(eq(schema.aiAgents.slug, agent.slug))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.aiAgents).values({
        ...agent,
        version: 1,
      });
      console.log(`  Created: ${agent.slug}`);
    } else {
      await db
        .update(schema.aiAgents)
        .set({
          ...agent,
          version: existing[0].version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.aiAgents.slug, agent.slug));
      console.log(`  Updated: ${agent.slug} (v${existing[0].version + 1})`);
    }
  }

  console.log(`\nSeeded ${AGENTS.length} AI agents.`);
  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
