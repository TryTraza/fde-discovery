import { z } from 'zod';
import { PROCESS_STATUSES, type ProcessStatus } from '@/lib/db/schema';

// Re-export for consumers that import from validations
export { PROCESS_STATUSES, type ProcessStatus };

export const VALID_TRANSITIONS: Record<ProcessStatus, ProcessStatus[]> = {
  draft: ['mapping'],
  mapping: ['draft', 'validated'],
  validated: ['mapping', 'locked'],
  locked: [],
};

export function validateStatusTransition(
  current: ProcessStatus,
  next: ProcessStatus
): { valid: boolean; error?: string } {
  if (current === next) return { valid: true };
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    return {
      valid: false,
      error: `Cannot transition from "${current}" to "${next}". Allowed: ${allowed?.join(', ') || 'none'}`,
    };
  }
  return { valid: true };
}

// --- Create schema ---

export const createProcessSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  departmentTag: z.string().optional(),
  knownSystems: z.array(z.string()).optional(),
  knownPainPoints: z.string().optional(),
});

export type CreateProcessInput = z.infer<typeof createProcessSchema>;

// --- Regenerate hypothesis schema ---

export const regenerateHypothesisSchema = z.object({
  knownSystems: z.array(z.string()).optional(),
  knownPainPoints: z.string().optional(),
}).optional();

export type RegenerateHypothesisInput = z.infer<typeof regenerateHypothesisSchema>;

// --- Update schema ---

export const updateProcessSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(PROCESS_STATUSES).optional(),
  departmentTag: z.string().nullable().optional(),
}).strip().refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided',
});

export type UpdateProcessInput = z.infer<typeof updateProcessSchema>;

// --- JSONB step parsing ---

// Accept both object format { name, confirmed, detailNotes } and legacy string format "SystemName"
const systemEntrySchema = z.union([
  z.object({
    name: z.string(),
    confirmed: z.boolean().default(false),
    detailNotes: z.string().default(''),
  }),
  z.string().transform((s) => ({ name: s, confirmed: false, detailNotes: '' })),
]);

export const processStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  order: z.number(),
  systems: z.array(systemEntrySchema).default([]),
  confidence: z.enum(['confirmed', 'inferred', 'missing']).default('inferred'),
  edgeCases: z.array(z.any()).default([]),
  notes: z.string().default(''),
});

export type ProcessStepParsed = z.infer<typeof processStepSchema>;

// --- Bulk steps update schema (for drag-drop reorder + inline edit) ---

export const updateStepsSchema = z.object({
  steps: z.array(processStepSchema).min(1, 'At least one step is required'),
});

export type UpdateStepsInput = z.infer<typeof updateStepsSchema>;

export function parseProcessSteps(raw: unknown): ProcessStepParsed[] {
  if (!raw || !Array.isArray(raw)) return [];
  try {
    return raw
      .map((item) => processStepSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data)
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}
