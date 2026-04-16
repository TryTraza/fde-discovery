import 'server-only'
import { updateProcess, updateProcessModel } from '@/lib/db/queries/processes'
import type { ProcessHypothesisGatewayResult } from '@/lib/ai/gateway'

/**
 * Persists a hypothesis generation result: legacy steps in the
 * process_models row, hypothesisText + processTypeL1 + structured
 * hypothesis on the processes row.
 *
 * Never throws — individual writes are isolated so a partial failure
 * (e.g. steps persisted but processes row update errored) still leaves
 * the app in a usable state.
 */
export async function persistHypothesisResult(
  processId: string,
  result: ProcessHypothesisGatewayResult
): Promise<void> {
  const fullSteps = result.initialSteps.map((step) => ({
    id: crypto.randomUUID(),
    name: step.name,
    description: step.description,
    order: step.order,
    systems: step.systems.map((s) => ({ name: s, confirmed: false, detailNotes: '' })),
    confidence: 'inferred' as const,
    nextSteps: [] as string[],
    relatedEdgeCases: [] as string[],
    edgeCases: [],
    notes: '',
  }))

  await updateProcessModel(processId, { steps: fullSteps }).catch((err) => {
    console.error(`[hypothesis] updateProcessModel failed for ${processId}:`, err)
  })

  await updateProcess(processId, {
    hypothesisText: result.hypothesisText,
    hypothesis: result.structured,
    processTypeL1: result.matchedProcessType,
  }).catch((err) => {
    console.error(`[hypothesis] updateProcess failed for ${processId}:`, err)
  })
}
