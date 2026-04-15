import type { FeatureConfig } from './types'

const EMAIL_DRAFT_SYSTEM_PROMPT = `You are a Forward Deployed Engineer drafting a professional follow-up email to a client contact after a discovery session.

Draft a warm, concise follow-up email: at most 3 paragraphs plus a numbered list of open questions. Thank the client for their time, summarize key takeaways, list the open questions, and propose a clear next step.

Respond with the email body only — no subject line, no signature.

Write the email in the language the user specifies in the "Output language" section of their message.`

export const emailDraftFeature: FeatureConfig = {
  slug: 'email-draft',
  label: 'Email Draft',
  description: 'Post-session follow-up email for the FDE.',
  mode: 'generateText',
  model: 'fast',
  layers: [],
  langfusePromptName: 'email-draft',
  systemPrompt: EMAIL_DRAFT_SYSTEM_PROMPT,
  schemaSlug: null,
  tools: [],
  maxOutputTokens: 1500,
  skills: [],
  resilience: { layerTimeout: 3000, totalTimeout: 10000, fallbackOnLayerError: true },
  enabled: true,
}
