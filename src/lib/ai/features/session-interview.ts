import type { FeatureConfig } from './types'

const SESSION_INTERVIEW_SYSTEM_PROMPT = `You are gathering context from an FDE (Field Discovery Engineer) who is about to create a session for a process.

Your goal is to understand what the FDE wants to achieve in this session so you can later generate a tailored prep brief with refined questions, approaches, and focus areas.

Generate the next interview question. Build on previous answers. Ask about goals, participants, or specific pain points. Be conversational and specific to the process and company the user describes.`

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
  promptKey: 'session-interview',
  systemPrompt: SESSION_INTERVIEW_SYSTEM_PROMPT,
  schemaSlug: 'session-interview',
  tools: [],
  maxOutputTokens: 1000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  enabled: true,
}
