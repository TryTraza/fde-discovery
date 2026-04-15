import { z } from 'zod';
import { suggestionsSchema } from './suggestions';
import { hypothesisSchema } from './hypothesis';
import { interviewQuestionSchema } from './interview';
import { prepBriefSchema } from './prep-brief';
import { synthesisOutputSchema } from './synthesis';
import type { SchemaRegistryEntry } from '@/lib/ai/types';

const schemaRegistry: Record<string, SchemaRegistryEntry> = {
  'capture-suggestions': {
    slug: 'capture-suggestions',
    label: 'Capture Suggestions',
    description: 'Array of suggested next steps with text and rationale.',
    schema: suggestionsSchema,
  },
  'process-hypothesis': {
    slug: 'process-hypothesis',
    label: 'Process Hypothesis',
    description: 'Hypothesis text + matched process type + array of inferred process steps.',
    schema: hypothesisSchema,
  },
  'session-interview': {
    slug: 'session-interview',
    label: 'Session Interview',
    description: 'Follow-up question with context for session setup interview.',
    schema: interviewQuestionSchema,
  },
  'prep-brief': {
    slug: 'prep-brief',
    label: 'Prep Brief',
    description: 'Pre-session briefing with summary, questions, approaches, areas to probe, and watch-fors.',
    schema: prepBriefSchema,
  },
  'session-synthesis': {
    slug: 'session-synthesis',
    label: 'Session Synthesis',
    description: 'Post-session synthesis with process model changes, open questions, and confidence score.',
    schema: synthesisOutputSchema,
  },
  'shadowing-synthesis': {
    slug: 'shadowing-synthesis',
    label: 'Shadowing Synthesis',
    description: 'Post-shadowing synthesis with event analysis, system aggregation, and process model updates.',
    schema: synthesisOutputSchema,
  },
};

export function getSchema(slug: string): z.ZodType {
  const entry = schemaRegistry[slug];
  if (!entry) {
    throw new Error(
      `Unknown schema: "${slug}". Available: ${Object.keys(schemaRegistry).join(', ')}`
    );
  }
  return entry.schema;
}

export function listAvailableSchemas(): Array<{ slug: string; label: string; description: string }> {
  return Object.values(schemaRegistry).map(({ slug, label, description }) => ({
    slug,
    label,
    description,
  }));
}
