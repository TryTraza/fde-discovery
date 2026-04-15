'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { CLIENT_KEYS } from '@/modules/clients/lib/swr-keys'
import { clientsService } from '@/modules/clients/services/clients-service'
import type { CompanyProfile } from '@/modules/clients/types'

type Status = 'idle' | 'refreshing'

export function useCompanyProfileMutations(clientId: string) {
  const { mutate } = useSWRConfig()
  const [status, setStatus] = useState<Status>('idle')

  async function refreshProfile(): Promise<CompanyProfile | null> {
    setStatus('refreshing')
    try {
      const profile = await clientsService.refreshProfile(clientId)
      await mutate(CLIENT_KEYS.detail(clientId))
      toast.success('Company profile refreshed')
      return profile
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to refresh profile'
      toast.error('Failed to refresh profile', { description: message })
      return null
    } finally {
      setStatus('idle')
    }
  }

  return {
    refreshProfile,
    isRefreshing: status === 'refreshing',
  }
}
