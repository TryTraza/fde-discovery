import { z } from 'zod'

export const applySynthesisSchema = z.object({
  applySteps: z.boolean().default(true),
  applyEdgeCases: z.boolean().default(true),
  applySystems: z.boolean().default(true),
  applyQuestions: z.boolean().default(true),
})
