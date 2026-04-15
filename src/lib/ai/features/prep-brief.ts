import type { FeatureConfig } from './types'

export const prepBriefFeature: FeatureConfig = {
  slug: 'prep-brief',
  label: 'Prep Brief',
  description: 'Structured pre-session brief.',
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
  langfusePromptName: 'prep-brief',
  schemaSlug: 'prep-brief',
  tools: [],
  maxOutputTokens: 2000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  enabled: true,
}
