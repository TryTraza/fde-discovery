// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateText = vi.fn()
const mockGenerateObject = vi.fn()
const mockStepCountIs = vi.fn((n: number) => ({ __stepCount: n }))
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  stepCountIs: (...args: unknown[]) => mockStepCountIs(...(args as [number])),
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

describe('LocalAIGateway.researchClient', () => {
  const INPUT = {
    clientName: 'Acme',
    clientIndustry: 'Manufacturing',
    clientWebsite: 'https://acme.example.com',
    model: FAKE_MODEL,
    anthropic: { tools: { webSearch_20250305: () => ({ __tool: 'web_search' }) } },
  }

  const DISCOVERY_TEXT = 'Acme is a mid-size widget maker.'

  const DISCOVERY_STEPS_WITH_SOURCES = [
    {
      content: [
        {
          type: 'tool-result',
          output: [
            { url: 'https://acme.example.com', title: 'Acme Home' },
            { url: 'https://news.example.com/acme', title: 'News piece' },
          ],
        },
      ],
    },
    {
      content: [
        {
          type: 'tool-result',
          output: [
            // duplicate of the first URL — should be deduped
            { url: 'https://acme.example.com', title: 'Acme Home again' },
            { url: 'https://blog.example.com/acme', title: 'Blog piece' },
          ],
        },
        { type: 'text', text: 'some narration' },
      ],
    },
  ]

  const EXTRACTION_OBJECT = {
    companyOverview: 'Acme makes widgets.',
    fitScore: 8,
    fitScoreRationale: 'Clear manual bottlenecks.',
    areasOfExpertise: ['widgets'],
    productsAndServices: ['Widget Pro — Industrial widgets'],
    keyStakeholders: [],
    techStack: ['SAP'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateText.mockResolvedValue({
      text: DISCOVERY_TEXT,
      steps: DISCOVERY_STEPS_WITH_SOURCES,
    })
    mockGenerateObject.mockResolvedValue({ object: EXTRACTION_OBJECT })
  })

  it('calls generateText with the discovery system prompt, web-search tool, and stepCountIs(2)', async () => {
    await localAIGateway.researchClient(INPUT)
    const call = mockGenerateText.mock.calls[0][0]
    expect(call.system).toContain('senior business research analyst')
    expect(call.tools.web_search).toBeDefined()
    expect(call.stopWhen).toEqual({ __stepCount: 2 })
    expect(mockStepCountIs).toHaveBeenCalledWith(2)
  })

  it('renders the discovery template with name/industry/website', async () => {
    await localAIGateway.researchClient(INPUT)
    const call = mockGenerateText.mock.calls[0][0]
    expect(call.prompt).toContain('## Company')
    expect(call.prompt).toContain('Acme')
    expect(call.prompt).toContain('Manufacturing')
    expect(call.prompt).toContain('https://acme.example.com')
  })

  it('calls generateObject with the extraction system prompt and generated schema', async () => {
    await localAIGateway.researchClient(INPUT)
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.system).toContain('strict structured payload')
    expect(call.prompt).toContain('## Research material')
    expect(call.prompt).toContain(DISCOVERY_TEXT)
  })

  it('dedupes sources extracted from the discovery step content by URL', async () => {
    const out = await localAIGateway.researchClient(INPUT)
    const urls = out.researchSources.map((s) => s.url)
    expect(urls).toEqual([
      'https://acme.example.com',
      'https://news.example.com/acme',
      'https://blog.example.com/acme',
    ])
  })

  it('stamps every source with the same researchedAt snapshot', async () => {
    const out = await localAIGateway.researchClient(INPUT)
    const stamps = new Set(out.researchSources.map((s) => s.retrievedAt))
    expect(stamps.size).toBe(1)
    // And matches researchedAt itself
    expect(Array.from(stamps)[0]).toBe(out.researchedAt)
  })

  it('caps the discovery prose at 8000 chars before feeding extraction', async () => {
    const longText = 'x'.repeat(10000)
    mockGenerateText.mockResolvedValueOnce({ text: longText, steps: [] })
    await localAIGateway.researchClient(INPUT)
    const extractionCall = mockGenerateObject.mock.calls[0][0]
    // The prose appears inside the template body; its substring length
    // must be bounded by 8000. Extract the `## Research material` block.
    const match = /## Research material\n([\s\S]*?)(?=\n\n##|$)/.exec(extractionCall.prompt)
    expect(match).not.toBeNull()
    expect(match![1].length).toBeLessThanOrEqual(8000)
  })

  it('returns a clientResearchSchema-valid payload with schemaVersion 1', async () => {
    const out = await localAIGateway.researchClient(INPUT)
    expect(out.schemaVersion).toBe(1)
    expect(out.companyOverview).toBe('Acme makes widgets.')
    expect(out.fitScore).toBe(8)
    expect(typeof out.researchedAt).toBe('string')
    expect(() => new Date(out.researchedAt).toISOString()).not.toThrow()
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
    expect(call.prompt).toContain('## FDE personal notes')
    expect(call.prompt).toContain('N')
  })

  it('synthesizeShadowing threads event log + debrief into the user prompt', async () => {
    await localAIGateway.synthesizeShadowing({ sessionId: 's1', model: FAKE_MODEL })
    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.system).toContain('shadowing session')
    expect(call.prompt).toContain('## Chronological event log')
    expect(call.prompt).toContain('EV')
    expect(call.prompt).toContain('## Debrief answers')
    expect(call.prompt).toContain('D')
  })

  it('both methods return the AI output as-is', async () => {
    const a = await localAIGateway.synthesizeSession({ sessionId: 's1', model: FAKE_MODEL })
    const b = await localAIGateway.synthesizeShadowing({ sessionId: 's1', model: FAKE_MODEL })
    expect(a).toEqual(MOCK_OUTPUT)
    expect(b).toEqual(MOCK_OUTPUT)
  })
})
