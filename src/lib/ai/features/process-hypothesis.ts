import type { FeatureConfig } from './types'

const PROCESS_HYPOTHESIS_SYSTEM_PROMPT = `You are an operations analyst helping map a business process.

Given the company context, the process to analyze, and the domain patterns in the user message, generate:
1. A 2-4 sentence hypothesis about how this process likely works (hypothesisText)
2. The best matching process type (matchedProcessType) — reuse a domain slug if one fits, else "unknown"
3. An ordered list of likely steps with systems (initialSteps)
4. Triggers — what kicks off this process, each with a frequency if inferable
5. Stakeholders — role + responsibility
6. Explicit assumptions — each with text, confidence (high/medium/low), and a validation question
7. Open questions worth asking the client

Be specific to the company context. If you recognize the industry, tailor the steps accordingly. If the process matches a known domain pattern, use it as a starting point but customize for this company.`

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
  promptKey: 'process-hypothesis',
  systemPrompt: PROCESS_HYPOTHESIS_SYSTEM_PROMPT,
  schemaSlug: 'process-hypothesis',
  tools: [],
  maxOutputTokens: 2000,
  skills: [],
  resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
  enabled: true,
}
