import { describe, it, expect } from 'vitest'
import { PROMPTS, type PromptFixture } from '@/lib/ai/prompts/fixtures'

interface CompiledPrompt {
  systemPrompt: string
  userPrompt: string | null
}

function compileTestPrompt(name: string, vars: Record<string, string>): CompiledPrompt {
  const prompt = PROMPTS.find((p) => p.name === name)
  if (!prompt) throw new Error(`No test prompt fixture: ${name}`)

  const compile = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')

  const systemMsg = prompt.prompt.find((m) => m.role === 'system')
  const userMsg = prompt.prompt.find((m) => m.role === 'user')

  return {
    systemPrompt: systemMsg ? compile(systemMsg.content) : '',
    userPrompt: userMsg ? compile(userMsg.content) : null,
  }
}

function assertNoUnresolvedMarkers(result: CompiledPrompt) {
  const marker = /\{\{[^}]+\}\}/
  expect(result.systemPrompt).not.toMatch(marker)
  if (result.userPrompt) expect(result.userPrompt).not.toMatch(marker)
}

// ── capture-suggestions ──

describe('capture-suggestions prompt', () => {
  const vars = {
    domainKnowledge: '## Domain Knowledge\nProcurement: RFQ, PO, invoice matching',
    processModelSection:
      '## Current Process Model\n1. Create PO: Open ERP and create purchase order',
    sessionEventsSection: '- STEP: Open ERP\n- STEP: Check PO status',
  }

  it('includes domain knowledge when provided', () => {
    const result = compileTestPrompt('capture-suggestions', vars)
    expect(result.systemPrompt).toContain('Procurement')
    expect(result.systemPrompt).toContain('Domain Knowledge')
  })

  it('excludes domain section when domainKnowledge is empty', () => {
    const result = compileTestPrompt('capture-suggestions', { ...vars, domainKnowledge: '' })
    expect(result.systemPrompt).not.toContain('Domain Knowledge')
  })

  it('renders events in user prompt', () => {
    const result = compileTestPrompt('capture-suggestions', vars)
    expect(result.userPrompt).toContain('Open ERP')
    expect(result.userPrompt).toContain('Check PO status')
  })

  it('leaves no unresolved template markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('capture-suggestions', vars))
  })
})

// ── company-research ──

describe('company-research prompt', () => {
  const vars = {
    clientName: 'Acme Corp',
    clientIndustry: 'Manufacturing',
    clientWebsite: 'Their website is https://acme.com.',
  }

  it('includes company name and industry', () => {
    const result = compileTestPrompt('company-research', vars)
    expect(result.userPrompt).toContain('Acme Corp')
    expect(result.userPrompt).toContain('Manufacturing')
  })

  it('includes website context when provided', () => {
    const result = compileTestPrompt('company-research', vars)
    expect(result.userPrompt).toContain('https://acme.com')
  })

  it('leaves no unresolved markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('company-research', vars))
  })
})

// ── process-hypothesis ──

describe('process-hypothesis prompt', () => {
  const vars = {
    allDomains: '## procurement\nTypical steps: PO Creation -> Approval -> Receipt',
    clientName: 'Acme Corp',
    clientIndustry: 'Industry: Manufacturing',
    clientWebsite: 'Website: https://acme.com',
    processName: 'Purchase Order Processing',
    processDescription: 'Description: End-to-end PO workflow',
    processDepartment: 'Department: Finance',
  }

  it('includes all domains in system prompt', () => {
    const result = compileTestPrompt('process-hypothesis', vars)
    expect(result.systemPrompt).toContain('procurement')
  })

  it('includes process name in user prompt', () => {
    const result = compileTestPrompt('process-hypothesis', vars)
    expect(result.userPrompt).toContain('Purchase Order Processing')
  })

  it('leaves no unresolved markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('process-hypothesis', vars))
  })
})

// ── session-interview ──

describe('session-interview prompt', () => {
  const vars = {
    clientSection: '## Client: Acme Corp\n- Industry: Manufacturing',
    processSection: '## Process: PO Processing\n- Description: End-to-end PO workflow',
    processModelSection: '## Current Process Model\n1. Create PO',
    contactsSection: '## Contacts\n- Jane Doe (Procurement Manager)',
    previousAnswersSection: 'Q1: What are your goals? A: Map the PO process completely.',
  }

  it('includes client and process context', () => {
    const result = compileTestPrompt('session-interview', vars)
    expect(result.systemPrompt).toContain('Acme Corp')
    expect(result.systemPrompt).toContain('PO Processing')
  })

  it('includes previous answers in user prompt', () => {
    const result = compileTestPrompt('session-interview', vars)
    expect(result.userPrompt).toContain('Map the PO process')
  })

  it('leaves no unresolved markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('session-interview', vars))
  })
})

// ── prep-brief ──

describe('prep-brief prompt', () => {
  const vars = {
    clientSection: '## Client: Acme Corp\n- Industry: Manufacturing',
    processSection: '## Process: PO Processing',
    processModelSection: '## Model\n1. Create PO',
    contactsSection: '## Contacts\n- Jane Doe',
    priorSessionsSection: '## Prior Sessions\n- Discovery session: mapped basic flow',
    sessionInterviewAnswers: 'Goals: Map exceptions and edge cases',
  }

  it('includes all context sections', () => {
    const result = compileTestPrompt('prep-brief', vars)
    expect(result.systemPrompt).toContain('Acme Corp')
    expect(result.systemPrompt).toContain('PO Processing')
    expect(result.systemPrompt).toContain('Jane Doe')
  })

  it('leaves no unresolved markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('prep-brief', vars))
  })
})

// ── session-synthesis ──

describe('session-synthesis prompt', () => {
  const vars = {
    clientSection: '## Client: Acme Corp (Manufacturing)',
    processSection: '## Process: PO Processing',
    processModelSection: '## Model\n1. Create PO (stepId: abc123)',
    contactsSection: '',
    priorSessionsSection: '',
    sessionTranscript: 'Observed operator creating a PO in SAP.',
    sessionNotes: 'Step 3 seems redundant.',
    sessionInterviewAnswers: 'Goals: Map the full PO lifecycle.',
  }

  it('includes transcript and notes in user prompt', () => {
    const result = compileTestPrompt('session-synthesis', vars)
    expect(result.userPrompt).toContain('creating a PO in SAP')
    expect(result.userPrompt).toContain('Step 3 seems redundant')
  })

  it('includes synthesis instructions in system prompt', () => {
    const result = compileTestPrompt('session-synthesis', vars)
    expect(result.systemPrompt).toContain('changeType')
    expect(result.systemPrompt).toContain('stepId')
  })

  it('leaves no unresolved markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('session-synthesis', vars))
  })
})

// ── shadowing-synthesis ──

describe('shadowing-synthesis prompt', () => {
  const vars = {
    clientSection: '## Client: Acme Corp (Manufacturing)',
    processSection: '## Process: PO Processing',
    processModelSection: '## Model\n1. Create PO',
    sessionEventsSection: '- STEP: Open SAP\n- SYSTEM: SAP (detail: T-code ME21N)',
    debriefSection: '{"summary": "Good session, covered main flow"}',
    sessionTranscript: 'Observed full PO flow in SAP.',
    sessionNotes: 'Three separate spreadsheets used for tracking.',
    sessionInterviewAnswers: '',
  }

  it('includes events in user prompt', () => {
    const result = compileTestPrompt('shadowing-synthesis', vars)
    expect(result.userPrompt).toContain('Open SAP')
    expect(result.userPrompt).toContain('T-code ME21N')
  })

  it('includes detailNotes instruction in system prompt', () => {
    const result = compileTestPrompt('shadowing-synthesis', vars)
    expect(result.systemPrompt).toContain('detailNotes')
  })

  it('leaves no unresolved markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('shadowing-synthesis', vars))
  })
})

// ── email-draft ──

describe('email-draft prompt', () => {
  const vars = {
    languageInstruction: 'Write the email in English.',
    clientName: 'Acme Corp',
    processName: 'PO Processing',
    contactsList: 'Jane Doe (Procurement Manager), John Smith',
    synthesisHighlights: 'Mapped 7 steps, found 3 edge cases in approval workflow.',
    openQuestionsList: '1. Who approves POs over $10K?\n2. Is there a backup approver?',
  }

  it('includes client and process in user prompt', () => {
    const result = compileTestPrompt('email-draft', vars)
    expect(result.userPrompt).toContain('Acme Corp')
    expect(result.userPrompt).toContain('PO Processing')
  })

  it('includes language instruction in system prompt', () => {
    const result = compileTestPrompt('email-draft', vars)
    expect(result.systemPrompt).toContain('English')
  })

  it('includes contacts list', () => {
    const result = compileTestPrompt('email-draft', vars)
    expect(result.userPrompt).toContain('Jane Doe')
  })

  it('leaves no unresolved markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('email-draft', vars))
  })
})

// ── research-chat ──

describe('research-chat prompt', () => {
  const vars = {
    clientSection: '## Client: Acme Corp\n- Industry: Manufacturing',
    processSection: '## Process: PO Processing',
  }

  it('includes client context in system prompt', () => {
    const result = compileTestPrompt('research-chat', vars)
    expect(result.systemPrompt).toContain('Acme Corp')
  })

  it('includes FDE research focus', () => {
    const result = compileTestPrompt('research-chat', vars)
    expect(result.systemPrompt).toContain('research assistant')
    expect(result.systemPrompt).toContain('FDE')
  })

  it('has no user prompt (streaming uses messages)', () => {
    const result = compileTestPrompt('research-chat', vars)
    expect(result.userPrompt).toBeNull()
  })

  it('leaves no unresolved markers', () => {
    assertNoUnresolvedMarkers(compileTestPrompt('research-chat', vars))
  })
})

// ── All prompts: completeness check ──

describe('All prompts fixture completeness', () => {
  it('has exactly 9 prompts defined', () => {
    expect(PROMPTS).toHaveLength(9)
  })

  it('all prompts have unique names', () => {
    const names = PROMPTS.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('all prompts are chat type', () => {
    for (const p of PROMPTS) {
      expect(p.type).toBe('chat')
    }
  })

  it('all prompts have at least a system message', () => {
    for (const p of PROMPTS) {
      const system = p.prompt.find((m) => m.role === 'system')
      expect(system, `${p.name} missing system message`).toBeDefined()
      expect(system!.content.length).toBeGreaterThan(10)
    }
  })
})
