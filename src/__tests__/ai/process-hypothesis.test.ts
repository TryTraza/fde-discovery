// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  updateProcess: vi.fn().mockResolvedValue({}),
  updateProcessModel: vi.fn().mockResolvedValue({}),
}))

import { generateObject } from 'ai'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { updateProcess, updateProcessModel } from '@/lib/db/queries/processes'

describe('Process Hypothesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAIConfig).mockResolvedValue({
      model: 'mock-model' as any,
      modelId: 'claude-sonnet-4-6',
      anthropic: {} as any,
    })
  })

  it('calls generateObject with hypothesis schema', async () => {
    const { generateHypothesis } = await import('@/lib/ai/prompts/process-hypothesis')
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        hypothesisText: 'Test hypothesis',
        matchedProcessType: 'procurement',
        initialSteps: [],
      },
    } as any)

    await generateHypothesis({
      processName: 'Purchasing',
      companyName: 'Acme Corp',
    })

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.any(Object),
        maxOutputTokens: expect.any(Number),
      })
    )
    expect(getAIConfig).toHaveBeenCalledWith('hypothesis')
  })

  it('triggerProcessHypothesis updates DB on success', async () => {
    const { triggerProcessHypothesis } = await import('@/lib/ai/prompts/process-hypothesis')
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        hypothesisText: 'This process likely...',
        matchedProcessType: 'procurement',
        initialSteps: [{ name: 'Step 1', description: 'Do thing', systems: ['SAP'], order: 1 }],
      },
    } as any)

    triggerProcessHypothesis(
      'process-123',
      { name: 'Acme Corp', industry: 'Manufacturing' },
      { name: 'Purchasing' },
      'mock-model' as any
    )

    await vi.waitFor(() => {
      expect(updateProcess).toHaveBeenCalledWith(
        'process-123',
        expect.objectContaining({
          hypothesisText: 'This process likely...',
          processTypeL1: 'procurement',
        })
      )
      expect(updateProcessModel).toHaveBeenCalledWith(
        'process-123',
        expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              name: 'Step 1',
              confidence: 'inferred',
              systems: expect.arrayContaining([
                expect.objectContaining({ name: 'SAP', confirmed: false }),
              ]),
            }),
          ]),
        })
      )
    })
  })

  it('maps AI steps to ProcessStepFull with correct defaults', async () => {
    const { triggerProcessHypothesis } = await import('@/lib/ai/prompts/process-hypothesis')
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        hypothesisText: 'Hypothesis',
        matchedProcessType: 'procurement',
        initialSteps: [
          { name: 'Step 1', description: 'Desc', systems: ['SAP', 'Email'], order: 1 },
        ],
      },
    } as any)

    triggerProcessHypothesis(
      'process-123',
      { name: 'Acme Corp' },
      { name: 'Purchasing' },
      'mock-model' as any
    )

    await vi.waitFor(() => {
      const steps = vi.mocked(updateProcessModel).mock.calls[0][1].steps
      expect(steps[0]).toMatchObject({
        id: expect.any(String),
        name: 'Step 1',
        description: 'Desc',
        order: 1,
        confidence: 'inferred',
        edgeCases: [],
        notes: '',
        systems: [
          { name: 'SAP', confirmed: false, detailNotes: '' },
          { name: 'Email', confirmed: false, detailNotes: '' },
        ],
      })
    })
  })

  it('includes all L1 domain context in prompt', async () => {
    const { generateHypothesis } = await import('@/lib/ai/prompts/process-hypothesis')
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        hypothesisText: 'Test',
        matchedProcessType: 'unknown',
        initialSteps: [],
      },
    } as any)

    await generateHypothesis({
      processName: 'Something',
      companyName: 'Test Corp',
    })

    const callArgs = vi.mocked(generateObject).mock.calls[0][0]
    expect(callArgs.prompt).toContain('procurement')
    expect(callArgs.prompt).toContain('unknown')
    expect(callArgs.prompt).toContain('Purchase Request Received')
  })

  it('handles generateObject errors gracefully', async () => {
    const { triggerProcessHypothesis } = await import('@/lib/ai/prompts/process-hypothesis')
    vi.mocked(generateObject).mockRejectedValue(new Error('API error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    triggerProcessHypothesis(
      'process-123',
      { name: 'Acme Corp' },
      { name: 'Purchasing' },
      'mock-model' as any
    )

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[hypothesis] Failed'),
        expect.any(Error)
      )
    })

    consoleSpy.mockRestore()
  })
})
