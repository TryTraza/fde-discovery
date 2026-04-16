import type { FeatureConfig } from './types'

const PREP_BRIEF_SYSTEM_PROMPT = `You are preparing an actionable session brief for an FDE (Field Discovery Engineer).

Based on the FDE's goals (if any), the company context, the process model, and any gaps from prior sessions provided in the user message, generate a comprehensive prep brief:

1. summary: a concise overview of what this session should accomplish
2. questionsToAsk: 5-8 refined, specific questions with rationale and follow-up
3. approaches: 2-4 tactical approaches for the session
4. areasToProbe: 3-5 specific areas where the FDE should push for deeper answers
5. watchFor: 2-3 red flags or signals that might indicate hidden complexity

Be specific to the company, industry, and process context in the user message. Avoid generic advice.`

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
  promptKey: 'prep-brief',
  systemPrompt: PREP_BRIEF_SYSTEM_PROMPT,
  schemaSlug: 'prep-brief',
  tools: [],
  maxOutputTokens: 2000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  enabled: true,
}
