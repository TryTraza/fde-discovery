import { z } from 'zod';

// Resolution types vary by event type:
// - QUESTION events: 'asked_answered' | 'open_question' | 'skipped'
// - IMPLICIT events: 'described' | 'open_question' | 'skipped'

const debriefItemSchema = z.object({
  eventLogId: z.string().uuid(),
  type: z.enum(['question', 'implicit']),
  resolution: z.enum(['asked_answered', 'described', 'open_question', 'skipped']),
  answer: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'important', 'nice_to_have']).optional(),
}).superRefine((item, ctx) => {
  // asked_answered requires answer AND must be a QUESTION event
  if (item.resolution === 'asked_answered') {
    if (item.type !== 'question') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'asked_answered' resolution is only valid for question events",
        path: ['resolution'],
      });
    }
    if (!item.answer?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'asked_answered' resolution requires a non-empty answer",
        path: ['answer'],
      });
    }
  }

  // described requires description AND must be an IMPLICIT event
  if (item.resolution === 'described') {
    if (item.type !== 'implicit') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'described' resolution is only valid for implicit events",
        path: ['resolution'],
      });
    }
    if (!item.description?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'described' resolution requires a non-empty description",
        path: ['description'],
      });
    }
  }

  // open_question requires priority (valid for both event types)
  if (item.resolution === 'open_question') {
    if (!item.priority) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'open_question' resolution requires a priority",
        path: ['priority'],
      });
    }
  }

  // skipped: no additional fields required (valid for both event types)
});

export const debriefSubmissionSchema = z.object({
  items: z.array(debriefItemSchema),
});

export type DebriefSubmission = z.infer<typeof debriefSubmissionSchema>;
