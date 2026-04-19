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
  stepCountIs: (n: number) => ({ __stepCount: n }),
}))

const mockBuildAIInput = vi.fn()
vi.mock('@/lib/ai/input-builder', () => ({
  buildAIInput: (...args: unknown[]) => mockBuildAIInput(...args),
}))

import { localAIGateway } from '@/lib/ai/gateway-local'
import { interviewQuestionSchema } from '@/lib/ai/schemas/interview'
import { prepBriefSchema } from '@/lib/ai/schemas/prep-brief'
import { suggestionsSchema } from '@/lib/ai/schemas/suggestions'
import { synthesisOutputSchema } from '@/lib/ai/schemas/synthesis'
import { clientResearchSchema, processHypothesisSchema } from '@/lib/ai/contracts'

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

describe('gateway parity — process-hypothesis', () => {
  it('LocalAIGateway.generateProcessHypothesis emits a contract-valid structured hypothesis', async () => {
    mockBuildAIInput.mockResolvedValue({
      templateVars: { allDomains: 'procurement' },
    })
    mockGenerateObject.mockResolvedValue({
      object: {
        hypothesisText: 'Summary.',
        matchedProcessType: 'procurement',
        initialSteps: [{ name: 'Step', description: 'Do', systems: ['SAP'], order: 1 }],
        triggers: [{ description: 'new PO' }],
        stakeholders: [{ role: 'Buyer', responsibility: 'submits' }],
        assumptions: [{ text: 'POs in SAP', confidence: 'low' }],
        openQuestions: [],
      },
    })

    const out = await localAIGateway.generateProcessHypothesis({
      processId: 'p1',
      clientName: 'Acme',
      clientIndustry: 'Manufacturing',
      clientWebsite: null,
      processName: 'PO',
      processDescription: null,
      processDepartment: null,
      model: FAKE_MODEL,
    })

    expect(out.structured).not.toBeNull()
    expect(processHypothesisSchema.safeParse(out.structured).success).toBe(true)
  })
})

describe('gateway parity — prep-brief', () => {
  it('LocalAIGateway.generatePrepBrief returns a prepBriefSchema-valid object', async () => {
    mockBuildAIInput.mockResolvedValue({
      templateVars: {
        clientSection: 'C',
        processSection: 'P',
        processModelSection: '',
        contactsSection: '',
        priorSessionsSection: '',
        sessionInterviewAnswers: '',
      },
    })
    mockGenerateObject.mockResolvedValue({
      object: {
        summary: 'Session summary.',
        questionsToAsk: [{ question: 'Q', rationale: 'R', followUp: 'F' }],
        approaches: [{ title: 'T', description: 'D' }],
        areasToProbe: ['area1', 'area2', 'area3'],
        watchFor: ['flag1', 'flag2'],
      },
    })

    const out = await localAIGateway.generatePrepBrief({ sessionId: 's1', model: FAKE_MODEL })
    expect(prepBriefSchema.safeParse(out).success).toBe(true)
  })
})

describe('gateway parity — capture-suggestions', () => {
  it('LocalAIGateway.generateCaptureSuggestions returns suggestions that match the schema', async () => {
    mockBuildAIInput.mockResolvedValue({
      templateVars: {
        domainKnowledge: 'procurement',
        processModelSection: '',
        sessionEventsSection: '',
      },
    })
    const suggestions = [
      { text: 'Open email', rationale: 'Starts the flow' },
      { text: 'Attach quote', rationale: 'Expected next' },
    ]
    mockGenerateObject.mockResolvedValue({ object: { suggestions } })

    const out = await localAIGateway.generateCaptureSuggestions({
      sessionId: 's1',
      model: FAKE_MODEL,
    })
    expect(Array.isArray(out)).toBe(true)
    expect(suggestionsSchema.safeParse({ suggestions: out }).success).toBe(true)
  })
})

describe('gateway parity — client-research', () => {
  it('LocalAIGateway.researchClient returns a contract-valid ClientResearchPayload', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Acme is a widget manufacturer.',
      steps: [
        {
          content: [
            {
              type: 'tool-result',
              output: [
                { url: 'https://acme.example.com', title: 'Acme Home' },
              ],
            },
          ],
        },
      ],
    })
    mockGenerateObject.mockResolvedValue({
      object: {
        companyOverview: 'Acme makes widgets.',
        fitScore: 7,
        areasOfExpertise: ['widgets'],
        productsAndServices: ['Widget Pro — Pro widgets'],
        keyStakeholders: [],
        techStack: [],
      },
    })

    const out = await localAIGateway.researchClient({
      clientName: 'Acme',
      clientIndustry: 'Manufacturing',
      clientWebsite: null,
      model: FAKE_MODEL,
      anthropic: { tools: { webSearch_20250305: () => ({}) } },
    })

    expect(clientResearchSchema.safeParse(out).success).toBe(true)
    expect(out.schemaVersion).toBe(1)
    expect(typeof out.researchedAt).toBe('string')
  })
})

describe('gateway parity — TrazaAIGateway stub', () => {
  it('throws NotImplementedError instead of corrupting the wire format', async () => {
    const { trazaAIGateway, NotImplementedError } = await import(
      '@/lib/ai/gateway-traza'
    )
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
      trazaAIGateway.researchClient({
        clientName: 'Acme',
        clientIndustry: 'Manufacturing',
        clientWebsite: null,
        model: FAKE_MODEL,
        anthropic: { tools: { webSearch_20250305: () => ({}) } },
      })
    ).rejects.toBeInstanceOf(NotImplementedError)
  })
})

describe('gateway parity — session-synthesis + shadowing-synthesis', () => {
  const VALID_SYNTHESIS = {
    summary: 'Session synthesized.',
    steps: [],
    edgeCases: [],
    systems: [],
    openQuestions: [],
    confidence: 80,
  }

  it('synthesizeSession output validates against synthesisOutputSchema', async () => {
    mockBuildAIInput.mockResolvedValue({
      templateVars: {
        clientSection: 'C',
        processSection: 'P',
        processModelSection: '',
        contactsSection: '',
        priorSessionsSection: '',
        sessionTranscript: 'T',
        sessionNotes: '',
        sessionInterviewAnswers: '',
      },
    })
    mockGenerateObject.mockResolvedValue({ object: VALID_SYNTHESIS })

    const out = await localAIGateway.synthesizeSession({ sessionId: 's1', model: FAKE_MODEL })
    expect(synthesisOutputSchema.safeParse(out).success).toBe(true)
  })

  it('synthesizeShadowing output validates against synthesisOutputSchema', async () => {
    mockBuildAIInput.mockResolvedValue({
      templateVars: {
        clientSection: 'C',
        processSection: 'P',
        processModelSection: '',
        sessionEventsSection: 'EV',
        debriefSection: 'D',
        sessionTranscript: '',
        sessionNotes: '',
        sessionInterviewAnswers: '',
      },
    })
    mockGenerateObject.mockResolvedValue({ object: VALID_SYNTHESIS })

    const out = await localAIGateway.synthesizeShadowing({ sessionId: 's1', model: FAKE_MODEL })
    expect(synthesisOutputSchema.safeParse(out).success).toBe(true)
  })
})
