import type { FeatureConfig } from './types'

export const researchChatFeature: FeatureConfig = {
  slug: 'research-chat',
  label: 'Research Chat',
  description: 'SSE research chat with web search.',
  mode: 'streamText',
  model: 'standard',
  layers: [
    { layer: 'l2-client', options: { fields: 'full' } },
    { layer: 'l3-process', options: { fields: 'summary', includeModel: false } },
  ],
  langfusePromptName: 'research-chat',
  schemaSlug: null,
  tools: [{ tool: 'web-search', options: { maxSteps: 5 } }],
  maxOutputTokens: 2000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 30000, fallbackOnLayerError: true },
  enabled: true,
}
