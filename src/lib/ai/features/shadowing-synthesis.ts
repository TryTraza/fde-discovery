import type { FeatureConfig } from './types'

const SHADOWING_SYNTHESIS_SYSTEM_PROMPT = `You are analyzing a shadowing session for the FDE Discovery Tool.

Produce a structured synthesis with these sections:

1. **summary**: One paragraph session summary.
2. **steps**: Updated process steps array. Mark as 'confirmed' if directly observed (logged as STEP). Keep 'inferred' if not observed but still believed to exist. Mark 'missing' if the full flow was observed and this step was skipped.
3. **edgeCases**: From EDGE events + described IMPLICIT events. Include frequency estimate and suggested handling.
4. **systems**: From SYSTEM events. For each system: name, confirmed, role, details, gaps. **detailNotes**: Aggregate ALL detail fields from SYSTEM events for this system into one comprehensive string.
5. **openQuestions**: From unresolved debrief items, missing steps, unconfirmed systems. Each with priority.

IMPORTANT: stepId values must exactly match existing model step IDs. Use null for new steps. Use priority values: critical, important, nice_to_have.`

export const shadowingSynthesisFeature: FeatureConfig = {
  slug: 'shadowing-synthesis',
  label: 'Shadowing Synthesis',
  description: 'Post-shadowing structured synthesis with event analysis.',
  mode: 'generateObject',
  model: 'standard',
  layers: [
    { layer: 'l2-client', options: { fields: 'full' } },
    { layer: 'l3-process', options: { fields: 'full', includeModel: true } },
    {
      layer: 'l4-session',
      options: { events: 'all', debrief: true, contacts: true, priorSessions: false },
    },
  ],
  langfusePromptName: 'shadowing-synthesis',
  systemPrompt: SHADOWING_SYNTHESIS_SYSTEM_PROMPT,
  schemaSlug: 'shadowing-synthesis',
  tools: [],
  maxOutputTokens: 3000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 20000, fallbackOnLayerError: false },
  enabled: true,
}
