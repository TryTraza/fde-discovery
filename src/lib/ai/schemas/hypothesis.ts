import { z } from 'zod'
import { CONFIDENCE_LEVEL, TRIGGER_FREQUENCY } from '@/lib/ai/contracts'

const confidenceEnum = z.enum([
  CONFIDENCE_LEVEL.HIGH,
  CONFIDENCE_LEVEL.MEDIUM,
  CONFIDENCE_LEVEL.LOW,
])

export const hypothesisStepSchema = z.object({
  name: z.string().describe('Step name'),
  description: z.string().describe('What happens in this step'),
  systems: z.array(z.string()).describe('Systems likely involved'),
  order: z.number().describe('Step order starting from 1'),
})

// Single AI call produces both shapes. The legacy fields
// (hypothesisText / matchedProcessType / initialSteps) feed the existing
// processes + processModels columns. The structured fields are composed
// into a ProcessHypothesis and written to processes.hypothesis.
export const hypothesisSchema = z.object({
  hypothesisText: z
    .string()
    .describe('A 2-4 sentence hypothesis about how this process likely works'),
  matchedProcessType: z
    .string()
    .describe('The L1 process type that best matches (e.g., "procurement", "unknown")'),
  initialSteps: z.array(hypothesisStepSchema).describe('Ordered list of likely process steps'),
  triggers: z
    .array(
      z.object({
        description: z.string(),
        frequency: z
          .enum([
            TRIGGER_FREQUENCY.DAILY,
            TRIGGER_FREQUENCY.WEEKLY,
            TRIGGER_FREQUENCY.MONTHLY,
            TRIGGER_FREQUENCY.ON_DEMAND,
            TRIGGER_FREQUENCY.OTHER,
          ])
          .optional(),
      })
    )
    .describe('What kicks off this process'),
  stakeholders: z
    .array(z.object({ role: z.string(), responsibility: z.string() }))
    .describe('People/roles involved'),
  assumptions: z
    .array(
      z.object({
        text: z.string(),
        confidence: confidenceEnum,
        validationQuestion: z.string().optional(),
      })
    )
    .describe('Assumptions behind the hypothesis, each with confidence and a validating question'),
  openQuestions: z.array(z.string()).describe('Gaps worth asking the client about').default([]),
})

export type HypothesisOutput = z.infer<typeof hypothesisSchema>
export type HypothesisStep = z.infer<typeof hypothesisStepSchema>
