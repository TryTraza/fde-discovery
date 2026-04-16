// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateObject = vi.fn()
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}))

import { extractResearchNoteResult } from '@/lib/ai/research/extract'
import { researchNoteResultSchema } from '@/lib/ai/contracts'

const FAKE_MODEL = { modelId: 'fake' } as any

describe('extractResearchNoteResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for an empty reply without invoking the model', async () => {
    const out = await extractResearchNoteResult({
      query: 'q',
      reply: '   ',
      model: FAKE_MODEL,
    })
    expect(out).toBeNull()
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })

  it('produces a contract-valid ResearchNoteResult on AI success', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        summary: 'Acme is a mid-size manufacturer.',
        findings: [
          { category: 'company', text: '500 employees', confidence: 'high' },
          { category: 'technical', text: 'Uses SAP', confidence: 'medium' },
        ],
      },
    })

    const out = await extractResearchNoteResult({
      query: 'Tell me about Acme',
      reply: 'Acme is a manufacturer with 500 employees and uses SAP.',
      model: FAKE_MODEL,
    })

    expect(out).not.toBeNull()
    expect(researchNoteResultSchema.safeParse(out).success).toBe(true)
    expect(out!.schemaVersion).toBe(1)
    expect(out!.findings).toHaveLength(2)
  })

  it('returns null on AI failure (best-effort)', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('Anthropic exploded'))
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const out = await extractResearchNoteResult({
      query: 'q',
      reply: 'reply',
      model: FAKE_MODEL,
    })
    expect(out).toBeNull()
    consoleSpy.mockRestore()
  })

  it('returns null when the AI output fails contract validation', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        summary: '',
        findings: [{ category: 'company', text: 'x', confidence: 'high' }],
      },
    })
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const out = await extractResearchNoteResult({
      query: 'q',
      reply: 'reply',
      model: FAKE_MODEL,
    })
    expect(out).toBeNull()
    consoleSpy.mockRestore()
  })
})
