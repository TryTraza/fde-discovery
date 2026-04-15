import type { FeatureConfig } from './types'

export const sessionSynthesisFeature: FeatureConfig = {
  slug: 'session-synthesis',
  label: 'Session Synthesis',
  description: 'Post-session structured synthesis for non-shadowing sessions.',
  mode: 'generateObject',
  model: 'standard',
  layers: [
    { layer: 'l2-client', options: { fields: 'full' } },
    { layer: 'l3-process', options: { fields: 'full', includeModel: true } },
    {
      layer: 'l4-session',
      options: { events: 'none', debrief: false, contacts: true, priorSessions: true },
    },
  ],
  langfusePromptName: 'session-synthesis',
  schemaSlug: 'session-synthesis',
  tools: [],
  maxOutputTokens: 3000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 20000, fallbackOnLayerError: false },
  enabled: true,
}
