import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../index'
import { aiAgents } from '../schema'
import {
  layerSpecSchema,
  toolSpecSchema,
  resilienceConfigSchema,
  type AIAgentConfig,
} from '@/lib/ai/types'

export async function getAgentBySlug(slug: string): Promise<AIAgentConfig | null> {
  const rows = await db
    .select()
    .from(aiAgents)
    .where(and(eq(aiAgents.slug, slug), eq(aiAgents.enabled, true)))
    .limit(1)

  if (rows.length === 0) return null

  const row = rows[0]
  return {
    ...row,
    layers: z.array(layerSpecSchema).parse(row.layers),
    skills: z.array(z.string()).parse(row.skills),
    tools: z.array(toolSpecSchema).parse(row.tools),
    resilience: resilienceConfigSchema.parse(row.resilience),
  } as AIAgentConfig
}

/** Like getAgentBySlug but includes disabled agents. For settings UI. */
export async function getAgentBySlugUnfiltered(slug: string) {
  const rows = await db.select().from(aiAgents).where(eq(aiAgents.slug, slug)).limit(1)
  return rows[0] ?? null
}

export async function listAgents() {
  return db.select().from(aiAgents).orderBy(aiAgents.slug)
}

export interface UpsertAgentInput {
  slug: string
  label: string
  description?: string | null
  mode: 'generateObject' | 'generateText' | 'streamText'
  model: 'fast' | 'standard'
  layers: Array<{ layer: string; options?: Record<string, unknown> }>
  langfusePromptName: string
  schemaSlug: string | null
  tools: Array<{ tool: string; options?: Record<string, unknown> }>
  maxOutputTokens: number
  skills: string[]
  resilience: { layerTimeout: number; totalTimeout: number; fallbackOnLayerError: boolean }
  enabled?: boolean
}

export async function upsertAgent(data: UpsertAgentInput) {
  // Check if agent with this slug already exists
  const existing = await db.select().from(aiAgents).where(eq(aiAgents.slug, data.slug)).limit(1)

  if (existing.length === 0) {
    // Insert new
    const [agent] = await db
      .insert(aiAgents)
      .values({
        slug: data.slug,
        label: data.label,
        description: data.description ?? null,
        mode: data.mode,
        model: data.model,
        layers: data.layers,
        langfusePromptName: data.langfusePromptName,
        schemaSlug: data.schemaSlug,
        tools: data.tools,
        maxOutputTokens: data.maxOutputTokens,
        skills: data.skills,
        resilience: data.resilience,
        enabled: data.enabled ?? true,
        version: 1,
      })
      .returning()
    return agent
  }

  // Update existing, increment version
  const [agent] = await db
    .update(aiAgents)
    .set({
      label: data.label,
      description: data.description ?? null,
      mode: data.mode,
      model: data.model,
      layers: data.layers,
      langfusePromptName: data.langfusePromptName,
      schemaSlug: data.schemaSlug,
      tools: data.tools,
      maxOutputTokens: data.maxOutputTokens,
      skills: data.skills,
      resilience: data.resilience,
      enabled: data.enabled ?? existing[0].enabled,
      version: existing[0].version + 1,
      updatedAt: new Date(),
    })
    .where(eq(aiAgents.slug, data.slug))
    .returning()
  return agent
}
