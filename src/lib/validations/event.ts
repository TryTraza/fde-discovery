import { z } from 'zod'
import { EVENT_TYPES_MUTABLE } from '@/lib/db/schema'

export const createEventSchema = z.object({
  sessionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  type: z.enum(EVENT_TYPES_MUTABLE),
  label: z.string().max(500).nullable().optional(),
  detail: z.string().max(5000).nullable().optional(),
  suggestionUsed: z.boolean().default(false),
})

export const createEventBatchSchema = z.object({
  events: z.array(createEventSchema).min(1).max(50),
})

export const updateEventSchema = z
  .object({
    label: z.string().max(500).optional(),
    detail: z.string().max(5000).optional(),
  })
  .refine((data) => data.label !== undefined || data.detail !== undefined, {
    message: 'At least one of label or detail must be provided',
  })

export type CreateEventInput = z.infer<typeof createEventSchema>
export type CreateEventBatchInput = z.infer<typeof createEventBatchSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
