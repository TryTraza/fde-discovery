import { z } from 'zod'
import type { LanguageModel } from 'ai'

// ═══════════════════════════════════════
// Layer System
// ═══════════════════════════════════════

export interface LayerParams {
  sessionId?: string
  processId?: string
  clientId?: string
  rawData?: Record<string, unknown>
}

export interface LayerResult {
  data: Record<string, unknown>
  templateVars: Record<string, string>
}

export interface ContextLayer<TOptions = unknown> {
  name: string
  resolve(params: LayerParams, options?: TOptions): Promise<LayerResult>
}

// ═══════════════════════════════════════
// Layer Option Types
// ═══════════════════════════════════════

export interface L1Options {
  mode: 'matched' | 'all'
}

export interface L2Options {
  fields?: 'full' | 'summary'
}

export interface L3Options {
  includeModel: boolean
  fields?: 'full' | 'summary'
}

export interface L4Options {
  events: 'all' | 'last20' | 'none'
  contacts: boolean
  priorSessions: boolean
  debrief: boolean
}

// ═══════════════════════════════════════
// Layer Spec (stored as JSONB in ai_agents)
// ═══════════════════════════════════════

export const layerSpecSchema = z.object({
  layer: z.enum(['l1-domain', 'l2-client', 'l3-process', 'l4-session']),
  options: z.record(z.string(), z.unknown()).optional(),
})

export type LayerSpec = z.infer<typeof layerSpecSchema>

// ═══════════════════════════════════════
// Tool Spec (stored as JSONB in ai_agents.tools)
// ═══════════════════════════════════════

export const toolSpecSchema = z.object({
  tool: z.string().min(1),
  options: z.record(z.string(), z.unknown()).optional(),
})

export type ToolSpec = z.infer<typeof toolSpecSchema>

// ═══════════════════════════════════════
// Config Sub-Types
// ═══════════════════════════════════════

export const resilienceConfigSchema = z.object({
  layerTimeout: z.number().int().positive(),
  totalTimeout: z.number().int().positive(),
  fallbackOnLayerError: z.boolean(),
})

export type ResilienceConfig = z.infer<typeof resilienceConfigSchema>

// ═══════════════════════════════════════
// AI Agent Config
// ═══════════════════════════════════════

export type AIMode = 'generateObject' | 'generateText' | 'streamText'
export type ModelTier = 'fast' | 'standard'

export const aiAgentConfigSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    description: z.string().nullable().default(null),
    mode: z.enum(['generateObject', 'generateText', 'streamText']),
    model: z.enum(['fast', 'standard']),
    layers: z.array(layerSpecSchema).default([]),
    langfusePromptName: z.string().min(1),
    schemaSlug: z.string().nullable().default(null),
    tools: z.array(toolSpecSchema).default([]),
    maxOutputTokens: z.number().int().positive().default(1000),
    skills: z.array(z.string()).default([]),
    resilience: resilienceConfigSchema,
    enabled: z.boolean().default(true),
  })
  .refine((c) => c.mode !== 'generateObject' || c.schemaSlug !== null, {
    message: 'generateObject mode requires a schemaSlug',
  })

export type AIAgentConfig = z.infer<typeof aiAgentConfigSchema> & {
  id: string
  version: number
  createdAt: Date
  updatedAt: Date
}

// ═══════════════════════════════════════
// Skills
// ═══════════════════════════════════════

export type SkillType = 'system-prompt' | 'context-enrichment' | 'instruction'

export interface Skill {
  id: string
  slug: string
  label: string
  description: string | null
  type: SkillType
  content: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface ResolvedSkills {
  systemPromptFragments: string[]
  contextEnrichments: Record<string, string>
  instructions: string[]
}

export const EMPTY_SKILLS: ResolvedSkills = {
  systemPromptFragments: [],
  contextEnrichments: {},
  instructions: [],
}

// ═══════════════════════════════════════
// Code-Side Registry Types
// ═══════════════════════════════════════

export interface ToolRegistryEntry {
  slug: string
  label: string
  description: string
  optionsSchema?: z.ZodType
  factory: (anthropic: any, options?: Record<string, unknown>) => unknown
}

export interface SchemaRegistryEntry {
  slug: string
  label: string
  description: string
  schema: z.ZodType
}

// ═══════════════════════════════════════
// Builder Input / Output
// ═══════════════════════════════════════

export interface AIBuilderInput {
  agentSlug: string
  params: LayerParams
  userId: string
  model?: LanguageModel
  anthropic?: any
  messages?: any[]
  overrides?: {
    templateVars?: Record<string, string>
    systemPromptAppend?: string
    userPromptAppend?: string
    modelTier?: ModelTier
  }
}

export interface AIBuilderResult<T = unknown> {
  data?: T
  text?: string
  stream?: any
  meta: {
    agentSlug: string
    configVersion: number
    promptVersion: number
    model: string
    layerTimings: Record<string, number>
    totalDuration: number
    layerErrors: Array<{ layer: string; error: string }>
    traceId?: string
  }
}
