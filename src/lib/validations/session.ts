import { z } from 'zod'
import { SESSION_TYPES, SESSION_STATUSES } from '@/lib/db/schema'

// Derived from schema enums — single source of truth
const sessionTypeZod = z.enum(SESSION_TYPES)
const sessionStatusZod = z.enum(SESSION_STATUSES)

// Date string validator — accepts YYYY-MM-DD or ISO datetime strings
const dateString = z
  .string()
  .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid date string' })

export const createSessionSchema = z.object({
  processId: z.string().uuid(),
  type: sessionTypeZod,
  title: z.string().min(1).max(200),
  date: dateString,
  contactIds: z
    .array(z.string().uuid())
    .optional()
    .default([])
    .transform((ids) => [...new Set(ids)]), // Deduplicate
  interviewAnswers: z
    .object({
      questions: z.array(z.object({ question: z.string(), answer: z.string() })),
    })
    .optional(),
})

// PATCH schema — only for API route. Internal callers (Steps 6, 7) bypass Zod.
export const updateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  date: dateString.optional(),
  status: sessionStatusZod.optional(),
  transcriptText: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  questionsAsked: z.array(z.boolean()).nullable().optional(),
})

export const interviewRequestSchema = z.object({
  processId: z.string().uuid(),
  sessionType: sessionTypeZod,
  previousAnswers: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  questionIndex: z.number().int().min(0).max(3),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>
