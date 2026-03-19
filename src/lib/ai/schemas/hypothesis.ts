import { z } from 'zod';

export const hypothesisStepSchema = z.object({
  name: z.string().describe('Step name'),
  description: z.string().describe('What happens in this step'),
  systems: z.array(z.string()).describe('Systems likely involved'),
  order: z.number().describe('Step order starting from 1'),
});

export const hypothesisSchema = z.object({
  hypothesisText: z.string().describe(
    'A 2-4 sentence hypothesis about how this process likely works, based on the company context and domain knowledge'
  ),
  matchedProcessType: z.string().describe(
    'The L1 process type that best matches (e.g., "procurement", "unknown")'
  ),
  initialSteps: z.array(hypothesisStepSchema).describe(
    'Ordered list of likely process steps'
  ),
});

export type HypothesisOutput = z.infer<typeof hypothesisSchema>;
export type HypothesisStep = z.infer<typeof hypothesisStepSchema>;
