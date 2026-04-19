/**
 * AIGateway — the single boundary between route handlers and AI execution.
 *
 * Every feature gets one method. Inputs are feature-shaped; outputs are the
 * domain contracts from src/lib/ai/contracts/. Once a feature is migrated
 * to the gateway, its route handler collapses to four lines:
 *
 *   1. authz
 *   2. const input = await build<Feature>Input(params)
 *   3. const output = await gateway.<method>(input)
 *   4. persist + return
 *
 * LocalAIGateway (gateway-local.ts) invokes Anthropic directly using the
 * feature config's systemPrompt + the rendered template. TrazaAIGateway
 * (gateway-traza.ts, Phase 2.9) ships the same input over HTTP to a
 * remote worker. Both implementations satisfy the same schema contracts,
 * which is what makes feature-by-feature cutover safe.
 */

import type { LanguageModel } from 'ai'
import type { ClientResearchPayload, ProcessHypothesis } from '@/lib/ai/contracts'
import type { PrepBrief } from '@/lib/ai/schemas/prep-brief'
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis'

/**
 * Shared: every gateway method receives a pre-resolved model (the caller
 * owns Clerk / API-key concerns) and whatever input the feature needs.
 */
interface WithModel {
  model: LanguageModel
}

export interface EmailDraftGatewayInput extends WithModel {
  clientName: string
  processName: string
  contacts: Array<{ name: string; role?: string | null }>
  synthesisHighlights: string
  openQuestions: string[]
  language: 'en' | 'es'
}

export interface SessionInterviewGatewayInput extends WithModel {
  processId: string
  previousAnswers: Array<{ question: string; answer: string }>
}

export interface InterviewQuestion {
  question: string
  context: string
}

export interface ProcessHypothesisGatewayInput extends WithModel {
  processId: string
  clientName: string
  clientIndustry: string | null
  clientWebsite: string | null
  processName: string
  processDescription: string | null
  processDepartment: string | null
}

export interface ProcessHypothesisGatewayResult {
  hypothesisText: string
  matchedProcessType: string
  initialSteps: Array<{ name: string; description: string; systems: string[]; order: number }>
  /** Composed ProcessHypothesis. null when composition fails (partial AI output). */
  structured: ProcessHypothesis | null
}

export interface PrepBriefGatewayInput extends WithModel {
  sessionId: string
}

export interface CaptureSuggestionsGatewayInput extends WithModel {
  sessionId: string
}

export interface CaptureSuggestion {
  text: string
  rationale: string
}

export interface ResearchClientGatewayInput extends WithModel {
  clientName: string
  clientIndustry: string | null
  clientWebsite: string | null
  /** Anthropic SDK tool factory. The local gateway invokes
   * `anthropic.tools.webSearch_20250305({...})` to enable web search
   * during discovery. Options like `maxUses` cap how many searches the
   * model can issue per step — essential for staying inside Anthropic's
   * per-minute input-token rate limit. Passed through the input so
   * `getAIConfig` stays the single auth boundary. */
  anthropic: {
    tools: {
      webSearch_20250305: (args?: {
        maxUses?: number
        allowedDomains?: string[]
        blockedDomains?: string[]
        userLocation?: { type: 'approximate'; city?: string; region?: string; country?: string }
      }) => unknown
    }
  }
}

export interface SessionSynthesisGatewayInput extends WithModel {
  sessionId: string
}

export interface ShadowingSynthesisGatewayInput extends WithModel {
  sessionId: string
}

export interface AIGateway {
  draftEmail(input: EmailDraftGatewayInput): Promise<string>
  generateInterviewQuestion(input: SessionInterviewGatewayInput): Promise<InterviewQuestion>
  generateProcessHypothesis(
    input: ProcessHypothesisGatewayInput
  ): Promise<ProcessHypothesisGatewayResult>
  generatePrepBrief(input: PrepBriefGatewayInput): Promise<PrepBrief>
  generateCaptureSuggestions(
    input: CaptureSuggestionsGatewayInput
  ): Promise<CaptureSuggestion[]>
  researchClient(input: ResearchClientGatewayInput): Promise<ClientResearchPayload>
  synthesizeSession(input: SessionSynthesisGatewayInput): Promise<SynthesisOutput>
  synthesizeShadowing(input: ShadowingSynthesisGatewayInput): Promise<SynthesisOutput>
}
