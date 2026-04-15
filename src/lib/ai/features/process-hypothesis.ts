import type { FeatureConfig } from './types'

export const processHypothesisFeature: FeatureConfig = {
  slug: 'process-hypothesis',
  label: 'Process Hypothesis',
  description: 'Structured hypothesis for a newly created process.',
  mode: 'generateObject',
  model: 'standard',
  layers: [
    { layer: 'l1-domain', options: { mode: 'all' } },
    { layer: 'l2-client', options: { fields: 'summary' } },
    { layer: 'l3-process', options: { fields: 'summary', includeModel: false } },
  ],
  langfusePromptName: 'process-hypothesis',
  schemaSlug: 'process-hypothesis',
  tools: [],
  maxOutputTokens: 2000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  enabled: true,
}
