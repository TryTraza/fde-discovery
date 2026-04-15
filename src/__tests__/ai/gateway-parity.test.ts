/**
 * Parity harness — permanent.
 *
 * For every feature that has crossed the gateway boundary, this suite
 * asserts that the output of each AIGateway implementation conforms to
 * the feature's contract. Phase 2.7 only exercises LocalAIGateway; when
 * TrazaAIGateway ships in Phase 2.9 each case grows a second scenario.
 *
 * Adding a feature here is non-optional — the suite is how we catch wire
 * drift between local and remote once Bloque 3 starts flipping flags.
 */

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateText = vi.fn()
const mockGenerateObject = vi.fn()
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}))

const mockBuildAIInput = vi.fn()
vi.mock('@/lib/ai/input-builder', () => ({
  buildAIInput: (...args: unknown[]) => mockBuildAIInput(...args),
}))

import { localAIGateway } from '@/lib/ai/gateway-local'
import { interviewQuestionSchema } from '@/lib/ai/schemas/interview'

const FAKE_MODEL = { modelId: 'fake-model' } as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('gateway parity — email-draft', () => {
  it('LocalAIGateway.draftEmail returns a non-empty string', async () => {
    mockGenerateText.mockResolvedValue({ text: 'Hi Jane, thanks for...' })

    const out = await localAIGateway.draftEmail({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [{ name: 'Jane', role: 'PM' }],
      synthesisHighlights: 'highlight',
      openQuestions: ['q'],
      language: 'en',
      model: FAKE_MODEL,
    })

    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('gateway parity — session-interview', () => {
  it('LocalAIGateway.generateInterviewQuestion returns an interviewQuestionSchema-valid object', async () => {
    mockBuildAIInput.mockResolvedValue({
      templateVars: {
        clientSection: 'client',
        processSection: 'process',
        processModelSection: '',
        contactsSection: '',
      },
    })
    mockGenerateObject.mockResolvedValue({
      object: { question: 'What triggers the process?', context: 'Understand inputs.' },
    })

    const out = await localAIGateway.generateInterviewQuestion({
      processId: 'p1',
      previousAnswers: [],
      model: FAKE_MODEL,
    })

    expect(interviewQuestionSchema.safeParse(out).success).toBe(true)
  })
})
