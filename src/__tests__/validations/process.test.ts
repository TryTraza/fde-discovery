import { describe, it, expect } from 'vitest'
import {
  createProcessSchema,
  updateProcessSchema,
  updateStepsSchema,
  validateStatusTransition,
  parseProcessSteps,
} from '@/lib/validations/process'

describe('Process Validation Schemas', () => {
  it('createProcessSchema requires name', () => {
    const result = createProcessSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('createProcessSchema accepts valid input', () => {
    const result = createProcessSchema.safeParse({
      name: 'Purchasing',
      description: 'End-to-end procurement',
      departmentTag: 'Operations',
      knownSystems: ['SAP', 'Email'],
      knownPainPoints: 'Slow approvals',
    })
    expect(result.success).toBe(true)
  })

  it('createProcessSchema accepts minimal input', () => {
    const result = createProcessSchema.safeParse({ name: 'Purchasing' })
    expect(result.success).toBe(true)
  })

  it('updateProcessSchema rejects empty object', () => {
    const result = updateProcessSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('updateProcessSchema strips unknown fields then rejects if empty', () => {
    const result = updateProcessSchema.safeParse({ hypothesisText: 'hacked' })
    expect(result.success).toBe(false)
  })

  it('validateStatusTransition allows draft → mapping', () => {
    expect(validateStatusTransition('draft', 'mapping').valid).toBe(true)
  })

  it('validateStatusTransition rejects draft → locked', () => {
    const result = validateStatusTransition('draft', 'locked')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Cannot transition')
  })

  it('parseProcessSteps returns empty array for null/undefined', () => {
    expect(parseProcessSteps(null)).toEqual([])
    expect(parseProcessSteps(undefined)).toEqual([])
    expect(parseProcessSteps('not an array')).toEqual([])
  })

  it('parseProcessSteps filters out malformed steps and sorts by order', () => {
    const raw = [
      { id: '1', name: 'Step B', description: 'B', order: 2, systems: [] },
      { bad: 'data' },
      { id: '2', name: 'Step A', description: 'A', order: 1, systems: [] },
    ]
    const result = parseProcessSteps(raw)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Step A')
    expect(result[1].name).toBe('Step B')
  })
})

describe('updateStepsSchema', () => {
  it('accepts valid steps array', () => {
    const result = updateStepsSchema.safeParse({
      steps: [
        {
          id: 's1',
          name: 'Receive quote',
          description: 'Via email',
          order: 1,
          confidence: 'confirmed',
          systems: [{ name: 'Email', confirmed: true, detailNotes: '' }],
          edgeCases: [],
          notes: '',
        },
        {
          id: 's2',
          name: 'Review quote',
          description: 'Check pricing',
          order: 2,
          confidence: 'inferred',
          systems: [],
          edgeCases: [],
          notes: '',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty steps array', () => {
    const result = updateStepsSchema.safeParse({ steps: [] })
    expect(result.success).toBe(false)
  })

  it('rejects steps without id', () => {
    const result = updateStepsSchema.safeParse({
      steps: [{ name: 'Step 1', description: 'Desc', order: 1 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects steps without name', () => {
    const result = updateStepsSchema.safeParse({
      steps: [{ id: 's1', description: 'Desc', order: 1 }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts steps with string systems (legacy format)', () => {
    const result = updateStepsSchema.safeParse({
      steps: [{ id: 's1', name: 'Step 1', description: '', order: 1, systems: ['SAP', 'Email'] }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.steps[0].systems[0]).toEqual({
        name: 'SAP',
        confirmed: false,
        detailNotes: '',
      })
    }
  })

  it('applies defaults for optional fields', () => {
    const result = updateStepsSchema.safeParse({
      steps: [{ id: 's1', name: 'Minimal step', order: 1 }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const step = result.data.steps[0]
      expect(step.description).toBe('')
      expect(step.confidence).toBe('inferred')
      expect(step.systems).toEqual([])
      expect(step.edgeCases).toEqual([])
      expect(step.notes).toBe('')
    }
  })

  it('rejects payload without steps key', () => {
    const result = updateStepsSchema.safeParse({ something: 'else' })
    expect(result.success).toBe(false)
  })
})
