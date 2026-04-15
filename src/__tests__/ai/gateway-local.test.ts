// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateText = vi.fn()
const mockGenerateObject = vi.fn()
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}))

// generateInterviewQuestion calls buildAIInput which reaches into DB code.
// Stub at the module boundary.
const mockBuildAIInput = vi.fn()
vi.mock('@/lib/ai/input-builder', () => ({
  buildAIInput: (...args: unknown[]) => mockBuildAIInput(...args),
}))

import { localAIGateway } from '@/lib/ai/gateway-local'
import { emailDraftFeature } from '@/lib/ai/features/email-draft'
import { sessionInterviewFeature } from '@/lib/ai/features/session-interview'

const FAKE_MODEL = { modelId: 'fake-model' } as any

describe('LocalAIGateway.draftEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateText.mockResolvedValue({ text: 'Dear team, ...' })
  })

  it('passes the feature systemPrompt as the system message', async () => {
    await localAIGateway.draftEmail({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [],
      synthesisHighlights: 'x',
      openQuestions: [],
      language: 'en',
      model: FAKE_MODEL,
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.system).toBe(emailDraftFeature.systemPrompt)
  })

  it('renders the template and passes it as the user prompt', async () => {
    await localAIGateway.draftEmail({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [{ name: 'Jane', role: 'PM' }],
      synthesisHighlights: 'highlight',
      openQuestions: ['q1'],
      language: 'es',
      model: FAKE_MODEL,
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.prompt).toContain('## Session')
    expect(call.prompt).toContain('Acme')
    expect(call.prompt).toContain('Jane (PM)')
    expect(call.prompt).toContain('## Output language')
    expect(call.prompt).toContain('Spanish')
  })

  it('applies the feature maxOutputTokens budget', async () => {
    await localAIGateway.draftEmail({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [],
      synthesisHighlights: 'x',
      openQuestions: [],
      language: 'en',
      model: FAKE_MODEL,
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.maxOutputTokens).toBe(emailDraftFeature.maxOutputTokens)
  })

  it('returns the model text as-is', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'hello world' })
    const result = await localAIGateway.draftEmail({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [],
      synthesisHighlights: 'x',
      openQuestions: [],
      language: 'en',
      model: FAKE_MODEL,
    })
    expect(result).toBe('hello world')
  })
})

describe('LocalAIGateway.generateInterviewQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateObject.mockResolvedValue({
      object: { question: 'What triggers the process?', context: 'Understand inputs.' },
    })
    mockBuildAIInput.mockResolvedValue({
      config: sessionInterviewFeature,
      layerResults: [],
      skills: { systemPromptFragments: [], contextEnrichments: {}, instructions: [] },
      templateVars: {
        clientSection: '## Client: Acme',
        processSection: '## Process: PO',
        processModelSection: '',
        contactsSection: '',
      },
      layerData: {},
      layerTimings: {},
      layerErrors: [],
    })
  })

  it('uses the feature systemPrompt as the system message', async () => {
    await localAIGateway.generateInterviewQuestion({
      processId: 'p1',
      previousAnswers: [],
      model: FAKE_MODEL,
    })
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.system).toBe(sessionInterviewFeature.systemPrompt)
  })

  it('renders layer sections into the user prompt', async () => {
    await localAIGateway.generateInterviewQuestion({
      processId: 'p1',
      previousAnswers: [],
      model: FAKE_MODEL,
    })
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.prompt).toContain('## Client: Acme')
    expect(call.prompt).toContain('## Process: PO')
    expect(call.prompt).toContain('## Previous answers')
    expect(call.prompt).toContain('first question')
  })

  it('renders previous answers when supplied', async () => {
    await localAIGateway.generateInterviewQuestion({
      processId: 'p1',
      previousAnswers: [{ question: 'Who starts it?', answer: 'The buyer.' }],
      model: FAKE_MODEL,
    })
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.prompt).toContain('Q1: Who starts it?')
    expect(call.prompt).toContain('A1: The buyer.')
  })

  it('returns the AI-produced question', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { question: 'Specific Q', context: 'Specific C' },
    })
    const out = await localAIGateway.generateInterviewQuestion({
      processId: 'p1',
      previousAnswers: [],
      model: FAKE_MODEL,
    })
    expect(out).toEqual({ question: 'Specific Q', context: 'Specific C' })
  })
})
