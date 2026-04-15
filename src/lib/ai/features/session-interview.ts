import type { FeatureConfig } from './types'

export const sessionInterviewFeature: FeatureConfig = {
  slug: 'session-interview',
  label: 'Session Interview',
  description: 'Next-question generation during an interview session.',
  mode: 'generateObject',
  model: 'standard',
  layers: [
    { layer: 'l2-client', options: { fields: 'full' } },
    { layer: 'l3-process', options: { fields: 'full', includeModel: true } },
  ],
  langfusePromptName: 'session-interview',
  schemaSlug: 'session-interview',
  tools: [],
  maxOutputTokens: 1000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  enabled: true,
}
