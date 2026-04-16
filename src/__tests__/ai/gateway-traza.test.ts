// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { NotImplementedError, trazaAIGateway } from '@/lib/ai/gateway-traza'

const FAKE_MODEL = { modelId: 'fake' } as any

describe('TrazaAIGateway (stub)', () => {
  it('every method throws NotImplementedError until Bloque 3 wires it', async () => {
    await expect(
      trazaAIGateway.draftEmail({
        clientName: 'Acme',
        processName: 'PO',
        contacts: [],
        synthesisHighlights: 'x',
        openQuestions: [],
        language: 'en',
        model: FAKE_MODEL,
      })
    ).rejects.toBeInstanceOf(NotImplementedError)

    await expect(
      trazaAIGateway.generateInterviewQuestion({
        processId: 'p1',
        previousAnswers: [],
        model: FAKE_MODEL,
      })
    ).rejects.toBeInstanceOf(NotImplementedError)

    await expect(
      trazaAIGateway.generatePrepBrief({ sessionId: 's1', model: FAKE_MODEL })
    ).rejects.toBeInstanceOf(NotImplementedError)

    await expect(
      trazaAIGateway.generateCaptureSuggestions({ sessionId: 's1', model: FAKE_MODEL })
    ).rejects.toBeInstanceOf(NotImplementedError)

    await expect(
      trazaAIGateway.refreshCompanyProfile({
        clientName: 'Acme',
        clientIndustry: 'Manufacturing',
        clientWebsite: null,
        model: FAKE_MODEL,
      })
    ).rejects.toBeInstanceOf(NotImplementedError)

    await expect(
      trazaAIGateway.synthesizeSession({ sessionId: 's1', model: FAKE_MODEL })
    ).rejects.toBeInstanceOf(NotImplementedError)

    await expect(
      trazaAIGateway.synthesizeShadowing({ sessionId: 's1', model: FAKE_MODEL })
    ).rejects.toBeInstanceOf(NotImplementedError)

    await expect(
      trazaAIGateway.generateProcessHypothesis({
        processId: 'p1',
        clientName: 'Acme',
        clientIndustry: null,
        clientWebsite: null,
        processName: 'PO',
        processDescription: null,
        processDepartment: null,
        model: FAKE_MODEL,
      })
    ).rejects.toBeInstanceOf(NotImplementedError)
  })

  it('error message points at the configured fallback', async () => {
    try {
      await trazaAIGateway.draftEmail({} as any)
    } catch (err) {
      expect(err).toBeInstanceOf(NotImplementedError)
      expect((err as Error).message).toContain('AI_GATEWAY_TRAZA')
    }
  })
})
