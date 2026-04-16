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
   * Fixture key into src/lib/ai/prompts/fixtures.ts. Used by unmigrated
   * features that still flow through executeAI. Features migrated to the
   * gateway (Phase 2.7+) provide `systemPrompt` directly and stop
   * reading fixtures; once every feature is migrated, this field and
   * fixtures.ts are both retired.
   */
  promptKey: string
  /**
   * Worker persona + task instructions + output-format rules. Static —
   * per-call variability must come from the user-side template, not
   * here. This is the string that will move to the Traza worker once
   * each feature is dispatched remotely (Bloque 3).
   *
   * Optional during the transition: features still routing through
   * executeAI + fixtures.ts do not need it yet.
   */
  systemPrompt?: string
  schemaSlug: string | null
  tools: ToolSpec[]
  maxOutputTokens: number
  skills: string[]
  resilience: ResilienceConfig
  enabled: boolean
}
