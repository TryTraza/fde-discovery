import 'server-only'
import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { hypothesisSchema, type HypothesisOutput, type HypothesisStep } from '../schemas/hypothesis'
import { processHypothesisSchema, type ProcessHypothesis } from '@/lib/ai/contracts'
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

function composeStructuredHypothesis(output: HypothesisOutput): ProcessHypothesis {
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
1. A 2-4 sentence hypothesis (hypothesisText)
2. The best matching process type (matchedProcessType)
3. An ordered list of likely steps with systems (initialSteps)
4. What kicks off this process (triggers) — each with a description and, if you can infer it, a frequency
5. Key stakeholders (stakeholders) — role + responsibility
6. Explicit assumptions (assumptions) — each with text, confidence (high/medium/low), and a question to validate it
7. Open questions worth asking the client (openQuestions)

Be specific to the company context. If you recognize the industry, tailor everything accordingly.
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

      let structured: ProcessHypothesis | null = null
      try {
        structured = composeStructuredHypothesis(result)
      } catch (err) {
        console.warn(
          `[hypothesis] Could not compose structured hypothesis for ${processId}:`,
          err
        )
      }

      await updateProcess(processId, {
        hypothesisText: result.hypothesisText,
        hypothesis: structured,
        processTypeL1: result.matchedProcessType,
      })

      console.log(
        `[hypothesis] Completed for process ${processId}: ${result.initialSteps.length} steps${structured ? ' (structured)' : ''}`
      )
    })
    .catch((err) => {
      console.error(`[hypothesis] Failed for process ${processId}:`, err)
    })
}
