import type { FeatureConfig } from './types'

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
  schemaSlug: 'shadowing-synthesis',
  tools: [],
  maxOutputTokens: 3000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 20000, fallbackOnLayerError: false },
  enabled: true,
}
