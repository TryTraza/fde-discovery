import { z } from 'zod'

export const interviewQuestionSchema = z.object({
  question: z.string().describe('A specific question for the FDE'),
  context: z.string().describe('Why this question matters'),
})
