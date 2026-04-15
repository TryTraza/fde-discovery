/**
 * WorkerInput — the shape that crosses the AIGateway boundary.
 *
 * Every AI feature has a variant here. The gateway caller (an API route)
 * builds one of these via input-builder.ts and passes it to the gateway.
 * LocalAIGateway unwraps it to feed executeAI / generateObject / etc.
 * TrazaAIGateway serialises it as-is to the HTTP worker endpoint.
 *
 * The discriminator is `feature` (the slug). All variants share:
 *   - schemaVersion: pinned to 1 for forward migration
 *   - renderedInput: the fully-rendered user prompt string (from templates/)
 *   - context: typed context bag for this feature (what the prompt needs
 *     to know about the caller's domain state; distinct from renderedInput
 *     because the worker may want structured access, not just text)
 *   - params: feature-specific parameters (IDs, flags)
 */

import type { CompanyProfile, ProcessGraph, ProcessHypothesis } from './index'

export const WORKER_INPUT_SCHEMA_VERSION = 1 as const

export type FeatureSlug =
  | 'email-draft'
  | 'session-interview'
  | 'process-hypothesis'
  | 'prep-brief'
  | 'capture-suggestions'
  | 'refresh-company-profile'
  | 'session-synthesis'
  | 'shadowing-synthesis'
  | 'research-chat'

interface BaseWorkerInput<T extends FeatureSlug, Ctx, Params> {
  feature: T
  schemaVersion: typeof WORKER_INPUT_SCHEMA_VERSION
  renderedInput: string
  context: Ctx
  params: Params
}

// --- Per-feature context shapes ---
// Each context is intentionally shallow. Prompts that need deeper state
// receive it pre-rendered inside renderedInput via the template layer.

export interface ClientContext {
  clientId: string
  clientName: string
  clientIndustry: string
  profile: CompanyProfile | null
}

export interface ProcessContext {
  processId: string
  processName: string
  processDescription: string | null
  processTypeL1: string | null
  hypothesis: ProcessHypothesis | null
  graph: ProcessGraph | null
}

export interface SessionContext {
  sessionId: string
  sessionType: string
  hasTranscript: boolean
  hasNotes: boolean
}

// --- Variants ---

export type EmailDraftInput = BaseWorkerInput<
  'email-draft',
  { client: ClientContext; process: ProcessContext; session: SessionContext },
  { sessionId: string }
>

export type SessionInterviewInput = BaseWorkerInput<
  'session-interview',
  { client: ClientContext; process: ProcessContext; session: SessionContext },
  { sessionId: string; previousAnswers: Array<{ question: string; answer: string }> }
>

export type ProcessHypothesisInput = BaseWorkerInput<
  'process-hypothesis',
  { client: ClientContext; process: ProcessContext },
  {
    processId: string
    knownSystems?: string[]
    knownPainPoints?: string
  }
>

export type PrepBriefInput = BaseWorkerInput<
  'prep-brief',
  { client: ClientContext; process: ProcessContext; session: SessionContext },
  { sessionId: string }
>

export type CaptureSuggestionsInput = BaseWorkerInput<
  'capture-suggestions',
  { client: ClientContext; process: ProcessContext; session: SessionContext },
  { sessionId: string; recentEvents: Array<{ type: string; label: string }> }
>

export type RefreshCompanyProfileInput = BaseWorkerInput<
  'refresh-company-profile',
  { client: ClientContext },
  { clientId: string }
>

export type SessionSynthesisInput = BaseWorkerInput<
  'session-synthesis',
  { client: ClientContext; process: ProcessContext; session: SessionContext },
  { sessionId: string }
>

export type ShadowingSynthesisInput = BaseWorkerInput<
  'shadowing-synthesis',
  { client: ClientContext; process: ProcessContext; session: SessionContext },
  { sessionId: string }
>

export type ResearchChatInput = BaseWorkerInput<
  'research-chat',
  { client: ClientContext; process: ProcessContext | null },
  { clientId: string; processId: string | null; message: string }
>

export type WorkerInput =
  | EmailDraftInput
  | SessionInterviewInput
  | ProcessHypothesisInput
  | PrepBriefInput
  | CaptureSuggestionsInput
  | RefreshCompanyProfileInput
  | SessionSynthesisInput
  | ShadowingSynthesisInput
  | ResearchChatInput

/** Extract the context type for a given feature slug — useful in generic gateways. */
export type WorkerInputFor<F extends FeatureSlug> = Extract<WorkerInput, { feature: F }>
