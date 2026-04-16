import type { FeatureConfig } from './types'

const RESEARCH_CHAT_SYSTEM_PROMPT = `You are a research assistant for a Forward Deployed Engineer at Traza AI. Help them research and understand client companies, industry patterns, operational processes, and system documentation.

Stay focused on FDE research. Be specific and actionable. Flag information that contradicts the current ProcessModel. Keep responses to 1-3 paragraphs unless asked for depth.`

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
  systemPrompt: RESEARCH_CHAT_SYSTEM_PROMPT,
  schemaSlug: null,
  tools: [{ tool: 'web-search', options: { maxSteps: 5 } }],
  maxOutputTokens: 2000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 30000, fallbackOnLayerError: true },
  enabled: true,
}
