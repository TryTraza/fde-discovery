import { processHypothesisSchema, type ProcessHypothesis } from '@/lib/ai/contracts'
import type { HypothesisOutput } from '@/lib/ai/schemas/hypothesis'

/**
 * Composes a contract-shaped ProcessHypothesis from the AI's raw output.
 *
 * Throws if the AI output is missing the structured fields
 * (triggers/stakeholders/assumptions). Callers decide whether to treat
 * that as a warning + fall back to hypothesis: null, or a hard error.
 */
export function composeStructuredHypothesis(output: HypothesisOutput): ProcessHypothesis {
  const expectedSystems = Array.from(
    new Set(output.initialSteps.flatMap((s) => s.systems))
  ).map((name) => ({
    name,
    purpose: 'Inferred from hypothesis steps',
    confidence: 'low' as const,
  }))

  return processHypothesisSchema.parse({
    schemaVersion: 1,
    summary: output.hypothesisText,
    triggers: output.triggers,
    stakeholders: output.stakeholders,
    inputs: [],
    outputs: [],
    expectedSystems,
    assumptions: output.assumptions,
    openQuestions: output.openQuestions ?? [],
    generatedAt: new Date().toISOString(),
  })
}
