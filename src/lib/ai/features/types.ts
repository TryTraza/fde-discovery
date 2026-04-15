/**
 * Static feature configuration. Replaces the ai_agents DB table.
 *
 * Each feature file under src/lib/ai/features/<slug>.ts exports a
 * FeatureConfig as its default export. The registry (./registry.ts)
 * collects them into a single map keyed by slug.
 *
 * Shape intentionally mirrors the legacy AIAgentConfig so the builder
 * can consume either during the transition.
 */

import type { LayerSpec, ResilienceConfig, ToolSpec } from '@/lib/ai/types'

export interface FeatureConfig {
  slug: string
  label: string
  description: string | null
  mode: 'generateObject' | 'generateText' | 'streamText'
  model: 'fast' | 'standard'
  layers: LayerSpec[]
  /**
   * Prompt identifier. Kept as `langfusePromptName` during the transition
   * so builder.ts fetchPrompt can still read fixtures by this name.
   * Post Phase 2.6 (Langfuse removal), templates in src/lib/ai/templates/
   * take over and this field is retired.
   */
  langfusePromptName: string
  schemaSlug: string | null
  tools: ToolSpec[]
  maxOutputTokens: number
  skills: string[]
  resilience: ResilienceConfig
  enabled: boolean
}
