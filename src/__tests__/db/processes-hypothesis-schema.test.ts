import { describe, expect, it } from 'vitest'
import { processes, type NewProcess } from '@/lib/db/schema'
import { processHypothesisSchema } from '@/lib/ai/contracts'
import { validProcessHypothesis } from '@/lib/ai/contracts/__fixtures__'

describe('processes.hypothesis column', () => {
  it('is declared as a jsonb column on the processes table', () => {
    const col = processes.hypothesis
    expect(col).toBeDefined()
    expect(col.name).toBe('hypothesis')
    expect(col.dataType).toBe('json')
  })

  it('coexists with the legacy hypothesisText text column', () => {
    expect(processes.hypothesisText).toBeDefined()
    expect(processes.hypothesisText.dataType).toBe('string')
  })

  it('NewProcess type accepts a valid ProcessHypothesis', () => {
    const candidate: NewProcess = {
      clientId: '00000000-0000-0000-0000-000000000001',
      name: 'PO approval',
      hypothesis: validProcessHypothesis,
    }
    expect(processHypothesisSchema.safeParse(candidate.hypothesis).success).toBe(true)
  })

  it('NewProcess type accepts hypothesis being null', () => {
    const candidate: NewProcess = {
      clientId: '00000000-0000-0000-0000-000000000001',
      name: 'PO approval',
      hypothesis: null,
    }
    expect(candidate.hypothesis).toBeNull()
  })
})
