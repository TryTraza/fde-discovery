import { captureSuggestionsFeature } from './capture-suggestions'
import { companyResearchFeature } from './company-research'
import { emailDraftFeature } from './email-draft'
import { prepBriefFeature } from './prep-brief'
import { processHypothesisFeature } from './process-hypothesis'
import { refreshCompanyProfileFeature } from './refresh-company-profile'
import { researchChatFeature } from './research-chat'
import { sessionInterviewFeature } from './session-interview'
import { sessionSynthesisFeature } from './session-synthesis'
import { shadowingSynthesisFeature } from './shadowing-synthesis'
import type { FeatureConfig } from './types'

/**
 * Source of truth for every AI feature's static configuration.
 * Queried by buildAIInput (via getFeatureConfig). The legacy
 * ai_agents DB table was retired in Phase 2.11 — code is the only
 * source of truth.
 */
export const FEATURES: Record<string, FeatureConfig> = {
  'capture-suggestions': captureSuggestionsFeature,
  'company-research': companyResearchFeature,
  'email-draft': emailDraftFeature,
  'prep-brief': prepBriefFeature,
  'process-hypothesis': processHypothesisFeature,
  'refresh-company-profile': refreshCompanyProfileFeature,
  'research-chat': researchChatFeature,
  'session-interview': sessionInterviewFeature,
  'session-synthesis': sessionSynthesisFeature,
  'shadowing-synthesis': shadowingSynthesisFeature,
}

export function getFeatureConfig(slug: string): FeatureConfig | null {
  return FEATURES[slug] ?? null
}

export function listFeatureSlugs(): string[] {
  return Object.keys(FEATURES)
}
