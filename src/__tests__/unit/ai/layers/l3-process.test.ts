import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
  getProcessWithModel: vi.fn(),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
}))

import { getProcessById, getProcessWithModel } from '@/lib/db/queries/processes'
import { getSessionById } from '@/lib/db/queries/sessions'
import { l3ProcessLayer } from '@/lib/ai/layers/l3-process'

const fakeProcess = {
  id: 'proc-1',
  clientId: 'client-1',
  name: 'Purchase Order Processing',
  description: 'End-to-end PO workflow',
  status: 'mapping',
  departmentTag: 'Finance',
  processTypeL1: 'procurement',
  hypothesisText: 'This is a procurement process.',
}

const fakeProcessModel = {
  steps: [{ name: 'Create PO', description: 'Create purchase order', order: 1 }],
  systems: [{ name: 'SAP', confirmed: true }],
  edgeCases: [{ description: 'Rush order bypass' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getProcessWithModel).mockResolvedValue({
    ...fakeProcess,
    processModel: fakeProcessModel,
    openQuestions: [],
  } as any)
  vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any)
  vi.mocked(getSessionById).mockResolvedValue({ processId: 'proc-1' } as any)
})

describe('L3 Process Layer', () => {
  it('loads process from DB when processId provided', async () => {
    const result = await l3ProcessLayer.resolve({ processId: 'proc-1' })
    expect(result.templateVars.processName).toBe('Purchase Order Processing')
  })

  it('uses rawData when processName present (skips DB)', async () => {
    const result = await l3ProcessLayer.resolve({
      rawData: { processName: 'Raw Process', processDescription: 'Desc' },
    })
    expect(getProcessWithModel).not.toHaveBeenCalled()
    expect(result.templateVars.processName).toBe('Raw Process')
  })

  it('resolves processId from sessionId', async () => {
    const result = await l3ProcessLayer.resolve({ sessionId: 'sess-1' })
    expect(getSessionById).toHaveBeenCalledWith('sess-1')
    expect(getProcessWithModel).toHaveBeenCalledWith('proc-1')
  })

  it('includeModel: true includes processModelSection', async () => {
    const result = await l3ProcessLayer.resolve({ processId: 'proc-1' }, { includeModel: true })
    expect(result.templateVars.processModelSection).toContain('Create PO')
    expect(result.templateVars.processModelSection).toContain('SAP')
  })

  it('includeModel: false returns empty processModelSection', async () => {
    const result = await l3ProcessLayer.resolve({ processId: 'proc-1' }, { includeModel: false })
    expect(result.templateVars.processModelSection).toBe('')
  })

  it('fields "summary" returns only name, description, department', async () => {
    const result = await l3ProcessLayer.resolve(
      { processId: 'proc-1' },
      { includeModel: false, fields: 'summary' }
    )
    expect(result.templateVars.processName).toBe('Purchase Order Processing')
    expect(result.templateVars.processDescription).toBe('End-to-end PO workflow')
    expect(result.templateVars.processDepartment).toBe('Finance')
  })

  it('fields "full" returns all process fields', async () => {
    const result = await l3ProcessLayer.resolve(
      { processId: 'proc-1' },
      { includeModel: true, fields: 'full' }
    )
    expect(result.templateVars.processName).toBeDefined()
    expect(result.templateVars.processSection).toContain('Purchase Order Processing')
  })

  it('renders processHypothesisSection when processes.hypothesis is populated', async () => {
    vi.mocked(getProcessWithModel).mockResolvedValue({
      ...fakeProcess,
      hypothesis: {
        schemaVersion: 1,
        summary: 'POs flow through SAP.',
        triggers: [{ description: 'New PO request', frequency: 'daily' }],
        stakeholders: [{ role: 'Buyer', responsibility: 'Submits PO' }],
        inputs: [],
        outputs: [],
        expectedSystems: [],
        assumptions: [
          {
            text: 'All POs in SAP',
            confidence: 'medium',
            validationQuestion: 'Off-system POs?',
          },
        ],
        openQuestions: ['What is the SLA?'],
        generatedAt: '2026-04-16T10:00:00.000Z',
      },
      processModel: fakeProcessModel,
      openQuestions: [],
    } as any)

    const result = await l3ProcessLayer.resolve({ processId: 'proc-1' })
    expect(result.templateVars.processHypothesisSection).toContain('Structured Hypothesis')
    expect(result.templateVars.processHypothesisSection).toContain('POs flow through SAP')
    expect(result.templateVars.processHypothesisSection).toContain('New PO request')
    expect(result.templateVars.processHypothesisSection).toContain('Buyer')
    expect(result.templateVars.processHypothesisSection).toContain('[medium]')
    expect(result.templateVars.processHypothesisSection).toContain('SLA')
  })

  it('returns empty hypothesis section when processes.hypothesis is null', async () => {
    vi.mocked(getProcessWithModel).mockResolvedValue({
      ...fakeProcess,
      hypothesis: null,
      processModel: fakeProcessModel,
      openQuestions: [],
    } as any)
    const result = await l3ProcessLayer.resolve({ processId: 'proc-1' })
    expect(result.templateVars.processHypothesisSection).toBe('')
  })

  it('exposes processModel.graph via data when populated', async () => {
    const graph = {
      schemaVersion: 1,
      nodes: [{ id: 'n1', type: 'step', label: 'Step 1', confidence: 'inferred', metadata: {} }],
      edges: [],
      edgeCases: [],
    }
    vi.mocked(getProcessWithModel).mockResolvedValue({
      ...fakeProcess,
      hypothesis: null,
      processModel: { ...fakeProcessModel, graph },
      openQuestions: [],
    } as any)

    const result = await l3ProcessLayer.resolve({ processId: 'proc-1' })
    expect(result.data.graph).toEqual(graph)
  })

  it('exposes hypothesis via data when populated', async () => {
    const hypothesis = {
      schemaVersion: 1,
      summary: 'x',
      triggers: [],
      stakeholders: [],
      inputs: [],
      outputs: [],
      expectedSystems: [],
      assumptions: [],
      openQuestions: [],
      generatedAt: '2026-04-16T10:00:00.000Z',
    }
    vi.mocked(getProcessWithModel).mockResolvedValue({
      ...fakeProcess,
      hypothesis,
      processModel: fakeProcessModel,
      openQuestions: [],
    } as any)

    const result = await l3ProcessLayer.resolve({ processId: 'proc-1' })
    expect(result.data.hypothesis).toEqual(hypothesis)
  })
})
