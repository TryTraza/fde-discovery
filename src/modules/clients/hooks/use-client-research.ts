'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ApiKeyMissingError } from '@/lib/api-client'
import { CLIENT_KEYS } from '@/modules/clients/lib/swr-keys'
import { clientResearchService } from '@/modules/clients/services/client-research-service'
import type { ClientResearch } from '@/modules/clients/types'

export function useClientResearch(clientId: string) {
  const { data, error, isLoading, mutate } = useSWR<ClientResearch | null>(
    clientId ? CLIENT_KEYS.research(clientId) : null,
    () => clientResearchService.get(clientId)
  )
  const [isResearching, setIsResearching] = useState(false)

  async function generate(): Promise<ClientResearch | null> {
    setIsResearching(true)
    try {
      const payload = await clientResearchService.generate(clientId)
      await mutate(payload, { revalidate: false })
      toast.success('Research updated')
      return payload
    } catch (err) {
      if (err instanceof ApiKeyMissingError) {
        toast.error('Set your Anthropic API key in Settings to use AI features.')
      } else {
        const description = err instanceof Error ? err.message : 'Unable to run research'
        toast.error('Research failed', { description })
      }
      return null
    } finally {
      setIsResearching(false)
    }
  }

  return {
    research: data ?? null,
    isLoading,
    isResearching,
    mutateResearch: mutate,
    generate,
    error,
  }
}
