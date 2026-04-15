import { z } from 'zod'

export const synthesisStepSchema = z.object({
  stepId: z.string().nullable().describe('ID of existing step, or null for new'),
  name: z.string(),
  description: z.string(),
  order: z.number(),
  confidence: z.enum(['confirmed', 'inferred', 'missing']),
  systems: z.array(z.string()),
  changeType: z.enum(['unchanged', 'modified', 'new', 'removed']),
  changeReason: z.string().optional(),
})

export const synthesisEdgeCaseSchema = z.object({
  edgeCaseId: z.string().nullable(),
  description: z.string(),
  frequency: z.enum(['rare', 'occasional', 'frequent', 'unknown']),
  suggestedHandling: z.string(),
  changeType: z.enum(['unchanged', 'modified', 'new']),
})

export const synthesisSystemSchema = z.object({
  name: z.string(),
  confirmed: z.boolean(),
  role: z.string().describe('What role this system plays'),
  details: z.string().describe('Specific details about how the system is used'),
  gaps: z.string().optional().describe('Unknown information about this system'),
  detailNotes: z
    .string()
    .optional()
    .describe(
      'Aggregated detail notes: column mappings, sheet names, data flows between systems. Combine ALL SYSTEM event detail fields for this system into one comprehensive string.'
    ),
  changeType: z.enum(['unchanged', 'modified', 'new']),
})

export const synthesisQuestionSchema = z.object({
  text: z.string(),
  priority: z.enum(['critical', 'important', 'nice_to_have']),
})

export const synthesisOutputSchema = z.object({
  summary: z.string().describe('2-3 sentence summary'),
  steps: z.array(synthesisStepSchema),
  edgeCases: z.array(synthesisEdgeCaseSchema),
  systems: z.array(synthesisSystemSchema),
  openQuestions: z.array(synthesisQuestionSchema),
  confidence: z.number().describe('Confidence score from 0 to 100'),
})

export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>
