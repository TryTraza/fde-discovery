import type { FeatureConfig } from './types'

export const emailDraftFeature: FeatureConfig = {
  slug: 'email-draft',
  label: 'Email Draft',
  description: 'Post-session follow-up email for the FDE.',
  mode: 'generateText',
  model: 'fast',
  layers: [],
  langfusePromptName: 'email-draft',
  schemaSlug: null,
  tools: [],
  maxOutputTokens: 1500,
  skills: [],
  resilience: { layerTimeout: 3000, totalTimeout: 10000, fallbackOnLayerError: true },
  enabled: true,
}
