import { describe, expectTypeOf, it } from 'vitest'
import {
  WORKER_INPUT_SCHEMA_VERSION,
  type ClientResearchInput,
  type EmailDraftInput,
  type FeatureSlug,
  type ProcessHypothesisInput,
  type ResearchChatInput,
  type SessionSynthesisInput,
  type WorkerInput,
  type WorkerInputFor,
} from '@/lib/ai/contracts'

describe('WorkerInput', () => {
  it('pins the schemaVersion to 1', () => {
    expectTypeOf(WORKER_INPUT_SCHEMA_VERSION).toEqualTypeOf<1>()
  })

  it('lists every feature slug exactly once', () => {
    // Compile-time exhaustiveness: every slug → a variant.
    const features: Record<FeatureSlug, true> = {
      'email-draft': true,
      'session-interview': true,
      'process-hypothesis': true,
      'prep-brief': true,
      'capture-suggestions': true,
      'client-research': true,
      'session-synthesis': true,
      'shadowing-synthesis': true,
      'research-chat': true,
    }
    expectTypeOf(features).toMatchTypeOf<Record<FeatureSlug, true>>()
  })

  it('narrows by the feature discriminator', () => {
    function narrow(input: WorkerInput): string {
      switch (input.feature) {
        case 'email-draft':
          expectTypeOf(input).toEqualTypeOf<EmailDraftInput>()
          return 'email'
        case 'session-synthesis':
          expectTypeOf(input).toEqualTypeOf<SessionSynthesisInput>()
          return 'synth'
        case 'process-hypothesis':
          expectTypeOf(input).toEqualTypeOf<ProcessHypothesisInput>()
          return 'hyp'
        case 'research-chat':
          expectTypeOf(input).toEqualTypeOf<ResearchChatInput>()
          return 'chat'
        default:
          return input.feature
      }
    }
    expectTypeOf(narrow).returns.toBeString()
  })

  it('WorkerInputFor extracts the variant for a given slug', () => {
    type Extracted = WorkerInputFor<'session-synthesis'>
    expectTypeOf<Extracted>().toEqualTypeOf<SessionSynthesisInput>()
  })
})
