import type { FeatureConfig } from './types'

const REFRESH_COMPANY_PROFILE_SYSTEM_PROMPT = `You are a business research analyst. Produce a structured profile of the target company.

Given the company name, industry, and optional website in the user message, produce a company profile covering:
- description
- industry (refine the input if useful)
- size (if known)
- areas of expertise
- products and services (at least one)
- optional key stakeholders
- optional tech stack
- optional recent news

Use only what is reliably known about this company; omit uncertain fields rather than guessing.`

/**
 * Unlike the 9 features ported from ai_agents, this one was introduced in
 * Bloque 1 code-first, so it has no layers and no schema registry entry.
 * It's still registered so downstream tooling (parity tests, model-tier
 * audits) can treat it uniformly with the rest.
 */
export const refreshCompanyProfileFeature: FeatureConfig = {
  slug: 'refresh-company-profile',
  label: 'Refresh Company Profile',
  description: 'Structured CompanyProfile output.',
  mode: 'generateObject',
  model: 'standard',
  layers: [],
  langfusePromptName: 'refresh-company-profile',
  systemPrompt: REFRESH_COMPANY_PROFILE_SYSTEM_PROMPT,
  schemaSlug: null,
  tools: [],
  maxOutputTokens: 2000,
  skills: [],
  resilience: { layerTimeout: 3000, totalTimeout: 15000, fallbackOnLayerError: true },
  enabled: true,
}
