import 'server-only'
import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { hypothesisSchema, type HypothesisStep } from '../schemas/hypothesis'
import { getAllL1Domains } from '@/lib/domain/l1'
import { updateProcess, updateProcessModel } from '@/lib/db/queries/processes'

interface ProcessStepFull {
  id: string
  name: string
  description: string
  order: number
  systems: Array<{
    name: string
    confirmed: boolean
    detailNotes: string
  }>
  confidence: 'inferred'
  edgeCases: []
  notes: string
}

function mapAIStepsToProcessSteps(aiSteps: HypothesisStep[]): ProcessStepFull[] {
  return aiSteps.map((step) => ({
    id: crypto.randomUUID(),
    name: step.name,
    description: step.description,
    order: step.order,
    systems: step.systems.map((s) => ({
      name: s,
      confirmed: false,
      detailNotes: '',
    })),
    confidence: 'inferred' as const,
    edgeCases: [],
    notes: '',
  }))
}

export async function generateHypothesis(input: {
  processName: string
  processDescription?: string
  companyName: string
  companyIndustry?: string
  companyWebsite?: string
  departmentTag?: string
  knownSystems?: string[]
  knownPainPoints?: string
  /** Pre-resolved model — pass this when calling outside request context (fire-and-forget). */
  model?: LanguageModel
}) {
  const model = input.model ?? (await getAIConfig('hypothesis')).model
  const allDomains = getAllL1Domains()

  const { object } = await generateObject({
    model,
    schema: hypothesisSchema,
    maxOutputTokens: 4096,
    prompt: `You are an operations analyst helping map a business process.

Company: ${input.companyName}
${input.companyIndustry ? `Industry: ${input.companyIndustry}` : ''}
${input.companyWebsite ? `Website: ${input.companyWebsite}` : ''}

Process to analyze: "${input.processName}"
${input.processDescription ? `Description: ${input.processDescription}` : ''}
${input.departmentTag ? `Department: ${input.departmentTag}` : ''}
${input.knownSystems?.length ? `Known systems: ${input.knownSystems.join(', ')}` : ''}
${input.knownPainPoints ? `Known pain points: ${input.knownPainPoints}` : ''}

Available process type templates (pick the best match for matchedProcessType, or "unknown" if none fit):
${allDomains.map((d) => `\n--- ${d.type} (${d.label}) ---\nTypical steps: ${d.typicalSteps.map((s) => s.name).join(' → ')}\nCommon systems: ${d.commonSystems.join(', ') || 'none specified'}`).join('\n')}

Based on this context, generate:
1. A hypothesis about how this process likely works at this company
2. The best matching process type from the templates above
3. An ordered list of likely steps with the systems involved

Be specific to the company context. If you recognize the industry, tailor the steps accordingly.
If the process matches a known template, use it as a starting point but customize for this company.`,
  })

  return object
}

export function triggerProcessHypothesis(
  processId: string,
  client: { name: string; industry?: string | null; website?: string | null },
  processInput: {
    name: string
    description?: string
    departmentTag?: string
    knownSystems?: string[]
    knownPainPoints?: string
  },
  /** Pre-resolved model — required because fire-and-forget runs outside request context. */
  model: LanguageModel
) {
  console.log(`[hypothesis] Starting generation for process ${processId}`)

  generateHypothesis({
    processName: processInput.name,
    processDescription: processInput.description,
    companyName: client.name,
    companyIndustry: client.industry ?? undefined,
    companyWebsite: client.website ?? undefined,
    departmentTag: processInput.departmentTag,
    knownSystems: processInput.knownSystems,
    knownPainPoints: processInput.knownPainPoints,
    model,
  })
    .then(async (result) => {
      // Write steps BEFORE hypothesisText — the UI polls for hypothesisText
      // and stops polling once it appears. Steps must be in DB by that point.
      const fullSteps = mapAIStepsToProcessSteps(result.initialSteps)

      const modelResult = await updateProcessModel(processId, { steps: fullSteps })
      if (!modelResult) {
        console.warn(
          `[hypothesis] Model row not found for process ${processId}. Steps were NOT persisted. The user can regenerate later.`
        )
      }

      await updateProcess(processId, {
        hypothesisText: result.hypothesisText,
        processTypeL1: result.matchedProcessType,
      })

      console.log(
        `[hypothesis] Completed for process ${processId}: ${result.initialSteps.length} steps`
      )
    })
    .catch((err) => {
      console.error(`[hypothesis] Failed for process ${processId}:`, err)
    })
}
