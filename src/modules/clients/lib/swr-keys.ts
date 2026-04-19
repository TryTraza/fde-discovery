import type { ClientFilters } from '@/modules/clients/types'

const BASE = '/api/clients'

export const CLIENT_KEYS = {
  list: (filters: ClientFilters) => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.status) params.set('status', filters.status)
    if (filters.industry) params.set('industry', filters.industry)
    return `${BASE}?${params.toString()}`
  },
  detail: (id: string) => `${BASE}/${id}`,
  contacts: (id: string) => `${BASE}/${id}/contacts`,
  research: (id: string) => `${BASE}/${id}/research`,
}

const isClientsKey = (key: unknown): key is string =>
  typeof key === 'string' && key.startsWith(BASE)

const matchList = (key: unknown): boolean =>
  typeof key === 'string' && (key.startsWith(`${BASE}?`) || /^\/api\/clients\/[^/]+$/.test(key))

const matchDetail = (key: unknown): boolean =>
  typeof key === 'string' && /^\/api\/clients\/[^/]+$/.test(key)

export const CLIENT_MATCH = {
  list: matchList,
  detail: matchDetail,
  allRelated: (key: unknown): boolean => isClientsKey(key),
}
