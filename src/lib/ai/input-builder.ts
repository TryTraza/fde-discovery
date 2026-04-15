/**
 * input-builder — the "context side" of AI invocation.
 *
 * Given an agent slug and LayerParams, returns everything a prompt needs
 * to be compiled (layer data, skills, merged template variables). Does NOT
 * touch Langfuse, prompts, tools, or model invocation — those stay in
 * builder.ts / executeAI.
 *
 * Split out so:
 *   1. Tests can snapshot the merged template vars deterministically.
 *   2. Phase 2.7 gateway code can reuse the same function when rendering
 *      templates and building WorkerInput without going through executeAI.
 */

import { getAgentBySlug } from '@/lib/db/queries/ai-agents'
import { getLayer } from '@/lib/ai/layers/registry'
import { resolveSkills } from '@/lib/ai/skills/resolver'
import { getFeatureConfig } from '@/lib/ai/features/registry'
import type { FeatureConfig } from '@/lib/ai/features/types'
import { EMPTY_SKILLS } from '@/lib/ai/types'
import type {
  AIAgentConfig,
  AIBuilderInput,
  LayerResult,
  LayerSpec,
  ResilienceConfig,
  ResolvedSkills,
} from '@/lib/ai/types'

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
}

export async function runLayers(
  specs: LayerSpec[],
  params: AIBuilderInput['params'],
  resilience: ResilienceConfig,
  trace?: any
): Promise<{
  results: LayerResult[]
  timings: Record<string, number>
  errors: Array<{ layer: string; error: string }>
}> {
  const timings: Record<string, number> = {}
  const errors: Array<{ layer: string; error: string }> = []

  const results = await Promise.all(
    specs.map(async (spec) => {
      const span = trace?.span({ name: `layer:${spec.layer}` })
      const start = Date.now()
      try {
        const layer = getLayer(spec.layer)
        const result = await Promise.race([
          layer.resolve(params, spec.options),
          rejectAfter(
            resilience.layerTimeout,
            `Layer ${spec.layer} timed out after ${resilience.layerTimeout}ms`
          ),
        ])
        timings[spec.layer] = Date.now() - start
        span?.end({
          output: { timing: timings[spec.layer], varsKeys: Object.keys(result.templateVars) },
        })
        return result
      } catch (err) {
        const duration = Date.now() - start
        timings[spec.layer] = duration
        const errorMsg = err instanceof Error ? err.message : String(err)
        errors.push({ layer: spec.layer, error: errorMsg })
        span?.end({ output: { timing: duration, error: errorMsg }, level: 'ERROR' })
        console.warn(`[AI] Layer ${spec.layer} failed (${duration}ms):`, errorMsg)

        if (!resilience.fallbackOnLayerError) {
          throw new Error(
            `Layer ${spec.layer} failed and fallbackOnLayerError is false: ${errorMsg}`
          )
        }
        return { data: {}, templateVars: {} } as LayerResult
      }
    })
  )

  return { results, timings, errors }
}

export function mergeLayerTemplateVars(results: LayerResult[]): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const r of results) {
    Object.assign(vars, r.templateVars)
  }
  return vars
}

export interface BuildAIInputResult {
  config: AIAgentConfig
  layerResults: LayerResult[]
  skills: ResolvedSkills
  /** Merged: layer templateVars + skill contextEnrichments + caller overrides. */
  templateVars: Record<string, string>
  /** Union of every layer's `data` map, keyed by layer name. */
  layerData: Record<string, Record<string, unknown>>
  layerTimings: Record<string, number>
  layerErrors: Array<{ layer: string; error: string }>
}

/**
 * Feature-first config lookup: static FEATURES map wins; DB fallback only
 * covers slugs that haven't been ported yet (all 9 are ported as of
 * Phase 2.5, so the DB branch is just transitional belt-and-suspenders
 * until Phase 2.11 drops the ai_agents table).
 */
async function resolveConfig(slug: string): Promise<AIAgentConfig> {
  const fromCode = getFeatureConfig(slug)
  if (fromCode) return featureToAgentConfig(fromCode)

  const fromDb = await getAgentBySlug(slug)
  if (fromDb) return fromDb

  throw new Error(`Unknown AI agent: "${slug}"`)
}

function featureToAgentConfig(f: FeatureConfig): AIAgentConfig {
  // AIAgentConfig carries DB-only metadata (id/version/timestamps) that
  // the rest of the pipeline reads for tracing. We synthesise stable
  // sentinel values for code-backed features — they live in tracing
  // output only and are distinguishable from real DB rows.
  return {
    id: `code:${f.slug}`,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    slug: f.slug,
    label: f.label,
    description: f.description,
    mode: f.mode,
    model: f.model,
    layers: f.layers,
    langfusePromptName: f.langfusePromptName,
    schemaSlug: f.schemaSlug,
    tools: f.tools,
    maxOutputTokens: f.maxOutputTokens,
    skills: f.skills,
    resilience: f.resilience,
    enabled: f.enabled,
  }
}

/**
 * Resolves layers + skills + overrides for a given agent slug.
 * Zero side-effects beyond reads and observability spans.
 */
export async function buildAIInput(
  agentSlug: string,
  params: AIBuilderInput['params'],
  options: {
    overrides?: AIBuilderInput['overrides']
    trace?: any
  } = {}
): Promise<BuildAIInputResult> {
  const config = await resolveConfig(agentSlug)

  const layerOutcome =
    config.layers.length > 0
      ? await runLayers(config.layers, params, config.resilience, options.trace)
      : { results: [] as LayerResult[], timings: {}, errors: [] }

  const skills = config.skills.length > 0 ? await resolveSkills(config.skills) : EMPTY_SKILLS

  const templateVars: Record<string, string> = {
    ...mergeLayerTemplateVars(layerOutcome.results),
    ...skills.contextEnrichments,
    ...options.overrides?.templateVars,
  }

  const layerData: Record<string, Record<string, unknown>> = {}
  for (let i = 0; i < config.layers.length; i++) {
    const spec = config.layers[i]
    const res = layerOutcome.results[i]
    if (res) layerData[spec.layer] = res.data
  }

  return {
    config,
    layerResults: layerOutcome.results,
    skills,
    templateVars,
    layerData,
    layerTimings: layerOutcome.timings,
    layerErrors: layerOutcome.errors,
  }
}
