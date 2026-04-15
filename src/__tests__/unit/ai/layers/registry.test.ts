import { describe, it, expect, vi } from 'vitest'

// Mock DB modules to avoid env var requirements on import
vi.mock('@/lib/db/queries/clients', () => ({ getClientById: vi.fn() }))
vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
  getProcessWithModel: vi.fn(),
}))
vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
  listSessionContacts: vi.fn(),
  getCompletedSessionsByProcess: vi.fn(),
}))
vi.mock('@/lib/db/queries/events', () => ({ getEventsBySessionId: vi.fn() }))
vi.mock('@/lib/domain/l1', () => ({ getL1: vi.fn(), getAllL1Domains: vi.fn() }))

import { getLayer } from '@/lib/ai/layers/registry'

describe('Layer Registry', () => {
  it('getLayer("l1-domain") returns L1 layer instance', () => {
    const layer = getLayer('l1-domain')
    expect(layer).toBeDefined()
    expect(layer.name).toBe('l1-domain')
  })

  it('getLayer("l2-client") returns L2 layer instance', () => {
    const layer = getLayer('l2-client')
    expect(layer.name).toBe('l2-client')
  })

  it('getLayer("l3-process") returns L3 layer instance', () => {
    const layer = getLayer('l3-process')
    expect(layer.name).toBe('l3-process')
  })

  it('getLayer("l4-session") returns L4 layer instance', () => {
    const layer = getLayer('l4-session')
    expect(layer.name).toBe('l4-session')
  })

  it('getLayer("nonexistent") throws with descriptive error', () => {
    expect(() => getLayer('nonexistent')).toThrow(/nonexistent/)
    expect(() => getLayer('nonexistent')).toThrow(/Available/)
  })
})
