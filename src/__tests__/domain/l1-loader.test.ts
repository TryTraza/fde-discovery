import { describe, it, expect } from 'vitest'
import { getL1, getAllL1Types, getAllL1Domains } from '@/lib/domain/l1'

describe('L1 Domain Loader', () => {
  it('loads procurement domain', () => {
    const domain = getL1('procurement')
    expect(domain.type).toBe('procurement')
    expect(domain.typicalSteps.length).toBeGreaterThan(0)
    expect(domain.typicalSteps[0]).toHaveProperty('name')
    expect(domain.typicalSteps[0]).toHaveProperty('typicalSystems')
  })

  it('returns unknown for unrecognized type', () => {
    const domain = getL1('nonexistent_type_xyz')
    expect(domain.type).toBe('unknown')
  })

  it('returns unknown for empty string', () => {
    const domain = getL1('')
    expect(domain.type).toBe('unknown')
  })

  it('getAllL1Types returns expected types', () => {
    const types = getAllL1Types()
    expect(types).toContain('procurement')
    expect(types).toContain('unknown')
    expect(types.length).toBe(2)
  })

  it('getAllL1Domains returns full domain objects', () => {
    const domains = getAllL1Domains()
    expect(domains.length).toBe(2)
    expect(domains.every((d) => d.typicalSteps.length > 0)).toBe(true)
  })
})
