import { describe, expect, it } from 'vitest'
import { clients, type NewClient } from '@/lib/db/schema'
import { companyProfileSchema } from '@/lib/ai/contracts'
import { validCompanyProfile } from '@/lib/ai/contracts/__fixtures__'

describe('clients.profile column', () => {
  it('is declared as a jsonb column on the clients table', () => {
    const col = clients.profile
    expect(col).toBeDefined()
    expect(col.name).toBe('profile')
    expect(col.dataType).toBe('json')
  })

  it('NewClient type accepts a valid CompanyProfile', () => {
    const candidate: NewClient = {
      name: 'Acme',
      industry: 'Manufacturing',
      profile: validCompanyProfile,
    }
    expect(companyProfileSchema.safeParse(candidate.profile).success).toBe(true)
  })

  it('NewClient type accepts profile being null', () => {
    const candidate: NewClient = {
      name: 'Acme',
      industry: 'Manufacturing',
      profile: null,
    }
    expect(candidate.profile).toBeNull()
  })
})
