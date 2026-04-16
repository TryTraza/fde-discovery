import type { FeatureConfig } from './types'

export const companyResearchFeature: FeatureConfig = {
  slug: 'company-research',
  label: 'Company Research',
  description: 'Free-form prose research for the AI Research card.',
  mode: 'generateText',
  model: 'standard',
  layers: [{ layer: 'l2-client', options: { fields: 'summary' } }],
  promptKey: 'company-research',
  schemaSlug: null,
  tools: [{ tool: 'web-search', options: { maxSteps: 3 } }],
  maxOutputTokens: 2000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 30000, fallbackOnLayerError: false },
  enabled: true,
}
