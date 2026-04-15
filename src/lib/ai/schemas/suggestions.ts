import { z } from 'zod'

export const suggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        text: z.string().max(100),
        rationale: z.string().max(200),
      })
    )
    .max(5),
})

export type SuggestionsOutput = z.infer<typeof suggestionsSchema>
