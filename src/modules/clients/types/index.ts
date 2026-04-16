export type { Client, NewClient, ClientStatus } from '@/lib/db/schema'
export type { CompanyProfile } from '@/lib/ai/contracts'
export { CLIENT_STATUSES } from '@/lib/db/schema'

export interface ClientFilters {
  search?: string
  status?: string
  industry?: string
}

export interface ClientCreateInput {
  name: string
  industry: string
  website?: string
  hqLocation?: string
  notes?: string
}

export type ClientUpdateInput = Partial<ClientCreateInput> & {
  status?: string
  aiSummary?: string
}
