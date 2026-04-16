/**
 * TrazaAIGateway — stub. Throws NotImplementedError on every method.
 *
 * Each method will be filled in Bloque 3 as the corresponding worker
 * lands on the Traza side. The transport will be HTTP for the
 * one-shot generateObject/generateText methods and SSE-over-HTTP for
 * streamResearchChat.
 *
 * The point of having the stub today is two-fold:
 *
 *   1. The factory (gateway-factory.ts) can already pick between
 *      LocalAIGateway and TrazaAIGateway based on env flags, so
 *      cutting a feature over to Traza is a one-line config change
 *      with zero code changes.
 *
 *   2. The parity test suite can mock the future HTTP call and
 *      assert the wire format is contract-shaped before any real
 *      Traza endpoint exists.
 */

import type {
  AIGateway,
  CaptureSuggestion,
  CaptureSuggestionsGatewayInput,
  EmailDraftGatewayInput,
  InterviewQuestion,
  PrepBriefGatewayInput,
  ProcessHypothesisGatewayInput,
  ProcessHypothesisGatewayResult,
  RefreshCompanyProfileGatewayInput,
  SessionInterviewGatewayInput,
  SessionSynthesisGatewayInput,
  ShadowingSynthesisGatewayInput,
} from './gateway'
import type { CompanyProfile } from '@/lib/ai/contracts'
import type { PrepBrief } from '@/lib/ai/schemas/prep-brief'
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis'

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(
      `TrazaAIGateway.${method} is not yet implemented. Set AI_GATEWAY_TRAZA to exclude this feature, or wait for the worker to land in Bloque 3.`
    )
    this.name = 'NotImplementedError'
  }
}

class TrazaAIGatewayImpl implements AIGateway {
  async draftEmail(_: EmailDraftGatewayInput): Promise<string> {
    throw new NotImplementedError('draftEmail')
  }
  async generateInterviewQuestion(_: SessionInterviewGatewayInput): Promise<InterviewQuestion> {
    throw new NotImplementedError('generateInterviewQuestion')
  }
  async generateProcessHypothesis(
    _: ProcessHypothesisGatewayInput
  ): Promise<ProcessHypothesisGatewayResult> {
    throw new NotImplementedError('generateProcessHypothesis')
  }
  async generatePrepBrief(_: PrepBriefGatewayInput): Promise<PrepBrief> {
    throw new NotImplementedError('generatePrepBrief')
  }
  async generateCaptureSuggestions(
    _: CaptureSuggestionsGatewayInput
  ): Promise<CaptureSuggestion[]> {
    throw new NotImplementedError('generateCaptureSuggestions')
  }
  async refreshCompanyProfile(_: RefreshCompanyProfileGatewayInput): Promise<CompanyProfile> {
    throw new NotImplementedError('refreshCompanyProfile')
  }
  async synthesizeSession(_: SessionSynthesisGatewayInput): Promise<SynthesisOutput> {
    throw new NotImplementedError('synthesizeSession')
  }
  async synthesizeShadowing(_: ShadowingSynthesisGatewayInput): Promise<SynthesisOutput> {
    throw new NotImplementedError('synthesizeShadowing')
  }
}

export const trazaAIGateway: AIGateway = new TrazaAIGatewayImpl()
