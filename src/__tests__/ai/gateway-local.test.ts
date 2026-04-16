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

describe('LocalAIGateway.generateProcessHypothesis', () => {
  const FULL_AI_OUTPUT = {
    hypothesisText: 'POs flow through SAP with Finance approval over $10k.',
    matchedProcessType: 'procurement',
    initialSteps: [
      { name: 'Submit PO', description: 'Buyer submits', systems: ['SAP'], order: 1 },
    ],
    triggers: [{ description: 'New PO request', frequency: 'daily' }],
    stakeholders: [{ role: 'Buyer', responsibility: 'Submits PO' }],
    assumptions: [
      {
        text: 'All POs in SAP',
        confidence: 'medium',
        validationQuestion: 'Off-system POs?',
      },
    ],
    openQuestions: ['What is the SLA?'],
  }

  const INPUT = {
    processId: 'p1',
    clientName: 'Acme',
    clientIndustry: 'Manufacturing',
    clientWebsite: null,
    processName: 'PO',
    processDescription: 'Buy things',
    processDepartment: null,
    model: FAKE_MODEL,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildAIInput.mockResolvedValue({
      templateVars: { allDomains: '## procurement\n- receive PO\n- approve\n- pay' },
    })
    mockGenerateObject.mockResolvedValue({ object: FULL_AI_OUTPUT })
  })

  it('passes the feature systemPrompt', async () => {
    await localAIGateway.generateProcessHypothesis(INPUT)
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.system).toContain('operations analyst')
  })

  it('renders domain patterns + company + process in the user prompt', async () => {
    await localAIGateway.generateProcessHypothesis(INPUT)
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.prompt).toContain('## Domain patterns')
    expect(call.prompt).toContain('procurement')
    expect(call.prompt).toContain('## Company')
    expect(call.prompt).toContain('Acme')
    expect(call.prompt).toContain('Manufacturing')
    expect(call.prompt).toContain('## Process')
    expect(call.prompt).toContain('Buy things')
  })

  it('returns legacy fields AND a composed structured hypothesis', async () => {
    const out = await localAIGateway.generateProcessHypothesis(INPUT)
    expect(out.hypothesisText).toBe(FULL_AI_OUTPUT.hypothesisText)
    expect(out.matchedProcessType).toBe('procurement')
    expect(out.initialSteps).toEqual(FULL_AI_OUTPUT.initialSteps)
    expect(out.structured).not.toBeNull()
    expect(out.structured!.schemaVersion).toBe(1)
    expect(out.structured!.summary).toBe(FULL_AI_OUTPUT.hypothesisText)
    expect(out.structured!.triggers).toHaveLength(1)
  })

  it('returns structured: null when AI output is missing structured fields', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        hypothesisText: 'partial',
        matchedProcessType: 'unknown',
        initialSteps: [],
      },
    })
    const out = await localAIGateway.generateProcessHypothesis(INPUT)
    expect(out.hypothesisText).toBe('partial')
    expect(out.structured).toBeNull()
  })
})

describe('LocalAIGateway.generatePrepBrief', () => {
  const MOCK_BRIEF = {
    summary: 'Validate the flow.',
    questionsToAsk: [{ question: 'Q', rationale: 'R', followUp: 'F' }],
    approaches: [{ title: 'Approach', description: 'Desc' }],
    areasToProbe: ['area'],
    watchFor: ['flag'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildAIInput.mockResolvedValue({
      templateVars: {
        clientSection: 'C',
        processSection: 'P',
        processModelSection: 'PM',
        contactsSection: 'Co',
        priorSessionsSection: 'Pr',
        sessionInterviewAnswers: 'Q1: X\nA1: Y',
      },
    })
    mockGenerateObject.mockResolvedValue({ object: MOCK_BRIEF })
  })

  it('uses the prep-brief systemPrompt and rendered template', async () => {
    await localAIGateway.generatePrepBrief({ sessionId: 's1', model: FAKE_MODEL })
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.system).toContain('session brief')
    expect(call.prompt).toContain('C')
    expect(call.prompt).toContain('## FDE interview answers')
  })

  it('returns the AI-produced brief', async () => {
    const out = await localAIGateway.generatePrepBrief({ sessionId: 's1', model: FAKE_MODEL })
    expect(out).toEqual(MOCK_BRIEF)
  })
})

describe('LocalAIGateway.synthesizeSession + synthesizeShadowing', () => {
  const MOCK_OUTPUT = {
    summary: 'Session summary.',
    steps: [],
    edgeCases: [],
    systems: [],
    openQuestions: [],
    confidence: 80,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateObject.mockResolvedValue({ object: MOCK_OUTPUT })
    mockBuildAIInput.mockResolvedValue({
      templateVars: {
        clientSection: 'C',
        processSection: 'P',
        processModelSection: 'PM',
        contactsSection: 'Co',
        priorSessionsSection: 'Pr',
        sessionTranscript: 'T',
        sessionNotes: 'N',
        sessionInterviewAnswers: '',
        sessionEventsSection: 'EV',
        debriefSection: 'D',
      },
    })
  })

  it('synthesizeSession threads layer vars into the user prompt', async () => {
    await localAIGateway.synthesizeSession({ sessionId: 's1', model: FAKE_MODEL })
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.system).toContain('process discovery')
    expect(call.prompt).toContain('## Session transcript')
    expect(call.prompt).toContain('T')
    expect(call.prompt).toContain('FDE personal notes')
  })

  it('synthesizeShadowing threads event log + debrief into the user prompt', async () => {
    await localAIGateway.synthesizeShadowing({ sessionId: 's1', model: FAKE_MODEL })
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.system).toContain('shadowing session')
    expect(call.prompt).toContain('## Chronological event log')
    expect(call.prompt).toContain('EV')
    expect(call.prompt).toContain('## Debrief answers')
  })

  it('both methods return the AI output as-is', async () => {
    const a = await localAIGateway.synthesizeSession({ sessionId: 's1', model: FAKE_MODEL })
    const b = await localAIGateway.synthesizeShadowing({ sessionId: 's1', model: FAKE_MODEL })
    expect(a).toEqual(MOCK_OUTPUT)
    expect(b).toEqual(MOCK_OUTPUT)
  })
})
