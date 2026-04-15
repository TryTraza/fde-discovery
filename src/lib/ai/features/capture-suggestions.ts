import type { FeatureConfig } from './types'

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
  schemaSlug: 'capture-suggestions',
  tools: [],
  maxOutputTokens: 500,
  skills: ['process-archaeology'],
  resilience: { layerTimeout: 3000, totalTimeout: 8000, fallbackOnLayerError: true },
  enabled: true,
}
