import { describe, it, expect } from 'vitest'
import { CLIENT_KEYS, CLIENT_MATCH } from '@/modules/clients/lib/swr-keys'

describe('CLIENT_KEYS factories', () => {
  it('list() builds /api/clients with query string', () => {
    expect(CLIENT_KEYS.list({})).toBe('/api/clients?')
    expect(CLIENT_KEYS.list({ search: 'x' })).toContain('search=x')
    expect(CLIENT_KEYS.list({ status: 'active_poc', industry: 'f' })).toContain('status=active_poc')
  })

  it('detail() builds /api/clients/:id', () => {
    expect(CLIENT_KEYS.detail('abc')).toBe('/api/clients/abc')
  })

  it('contacts() builds /api/clients/:id/contacts', () => {
    expect(CLIENT_KEYS.contacts('abc')).toBe('/api/clients/abc/contacts')
  })

  it('research() builds /api/clients/:id/research', () => {
    expect(CLIENT_KEYS.research('abc')).toBe('/api/clients/abc/research')
  })
})

describe('CLIENT_MATCH predicates', () => {
  it('list matches list keys only', () => {
    expect(CLIENT_MATCH.list('/api/clients?search=x')).toBe(true)
    expect(CLIENT_MATCH.list('/api/clients/abc')).toBe(true)
    expect(CLIENT_MATCH.list('/api/processes')).toBe(false)
    expect(CLIENT_MATCH.list(123)).toBe(false)
  })

  it('detail matches detail keys', () => {
    expect(CLIENT_MATCH.detail('/api/clients/abc')).toBe(true)
    expect(CLIENT_MATCH.detail('/api/clients?')).toBe(false)
  })

  it('allRelated matches any /api/clients key', () => {
    expect(CLIENT_MATCH.allRelated('/api/clients?search=x')).toBe(true)
    expect(CLIENT_MATCH.allRelated('/api/clients/abc')).toBe(true)
    expect(CLIENT_MATCH.allRelated('/api/clients/abc/contacts')).toBe(true)
    expect(CLIENT_MATCH.allRelated('/api/processes')).toBe(false)
    expect(CLIENT_MATCH.allRelated(null)).toBe(false)
  })
})
