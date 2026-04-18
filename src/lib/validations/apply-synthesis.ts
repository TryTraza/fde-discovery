import { z } from 'zod'

export const applySynthesisSchema = z.object({
  targetProcessId: z.string().uuid(),
  applySteps: z.boolean().default(true),
  applyEdgeCases: z.boolean().default(true),
  applySystems: z.boolean().default(true),
  applyQuestions: z.boolean().default(true),
})
