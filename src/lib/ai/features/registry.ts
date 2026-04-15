import { captureSuggestionsFeature } from './capture-suggestions'
import { companyResearchFeature } from './company-research'
import { emailDraftFeature } from './email-draft'
import { prepBriefFeature } from './prep-brief'
import { processHypothesisFeature } from './process-hypothesis'
import { researchChatFeature } from './research-chat'
import { sessionInterviewFeature } from './session-interview'
import { sessionSynthesisFeature } from './session-synthesis'
import { shadowingSynthesisFeature } from './shadowing-synthesis'
import type { FeatureConfig } from './types'

/**
 * Source of truth for every AI feature's static configuration.
 * Queried by buildAIInput (via getFeatureConfig). Falls back to
 * the DB-backed ai_agents table for unknown slugs during the
 * Phase 2.4–2.11 transition window; the fallback is removed when
 * 2.11 drops the ai_agents table.
 */
export const FEATURES: Record<string, FeatureConfig> = {
  'capture-suggestions': captureSuggestionsFeature,
  'company-research': companyResearchFeature,
  'email-draft': emailDraftFeature,
  'prep-brief': prepBriefFeature,
  'process-hypothesis': processHypothesisFeature,
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
