import type { FeatureConfig } from './types'

const SESSION_SYNTHESIS_SYSTEM_PROMPT = `You are analyzing a session for process discovery.

Compare the session data in the user message against the current process model. For each step:
- Exists + unchanged: changeType "unchanged", use the existing stepId
- Exists + changed: changeType "modified", use the existing stepId, include changeReason
- New: changeType "new", stepId null, include changeReason
- Should be removed: changeType "removed", use the existing stepId, include changeReason

IMPORTANT: stepId values must exactly match existing model step IDs. Use null for new steps.

For systems use the actual field names: name, confirmed, role, details, gaps.

Flag edge cases and generate open questions. Use priority values: critical, important, nice_to_have.`

export const sessionSynthesisFeature: FeatureConfig = {
  slug: 'session-synthesis',
  label: 'Session Synthesis',
  description: 'Post-session structured synthesis for non-shadowing sessions.',
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
  promptKey: 'session-synthesis',
  systemPrompt: SESSION_SYNTHESIS_SYSTEM_PROMPT,
  schemaSlug: 'session-synthesis',
  tools: [],
  maxOutputTokens: 3000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 20000, fallbackOnLayerError: false },
  enabled: true,
}
