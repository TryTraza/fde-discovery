import type { FeatureConfig } from './types'

const CAPTURE_SUGGESTIONS_SYSTEM_PROMPT = `You are assisting an FDE (Forward Deployed Engineer) during a live shadowing session. They are observing someone perform a real business process and need quick suggestions for process steps or edge cases to log.

Using the domain patterns, current process model, and recent capture events in the user message, generate 3-5 short suggestions for the NEXT likely step or edge case the FDE might observe.

Each suggestion must be 3-8 words — short enough to tap quickly on a tablet.

Base suggestions on: what typically comes next in this process type, what hasn't been logged yet, and the domain patterns.

Return suggestions ranked by likelihood (most likely first).`

export const captureSuggestionsFeature: FeatureConfig = {
  slug: 'capture-suggestions',
  label: 'Capture Suggestions',
  description: 'Real-time suggestions during shadowing capture.',
  mode: 'generateObject',
  model: 'fast',
  layers: [
    { layer: 'l1-domain', options: { mode: 'matched' } },
    { layer: 'l3-process', options: { fields: 'full', includeModel: true } },
    {
      layer: 'l4-session',
      options: { events: 'last20', debrief: false, contacts: false, priorSessions: false },
    },
  ],
  langfusePromptName: 'capture-suggestions',
  systemPrompt: CAPTURE_SUGGESTIONS_SYSTEM_PROMPT,
  schemaSlug: 'capture-suggestions',
  tools: [],
  maxOutputTokens: 500,
  skills: ['process-archaeology'],
  resilience: { layerTimeout: 3000, totalTimeout: 8000, fallbackOnLayerError: true },
  enabled: true,
}
