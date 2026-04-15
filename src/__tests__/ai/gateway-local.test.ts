// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateText = vi.fn()
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}))

import { localAIGateway } from '@/lib/ai/gateway-local'
import { emailDraftFeature } from '@/lib/ai/features/email-draft'

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
