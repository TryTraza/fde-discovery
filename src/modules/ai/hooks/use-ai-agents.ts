import useSWR, { useSWRConfig } from 'swr'
import {
  aiAgentsService,
  type AIAgent,
  type RegistriesResponse,
} from '@/modules/ai/services/ai-agents-service'
import { AI_AGENT_KEYS, AI_AGENT_MATCH } from '@/modules/ai/lib/swr-keys'

export function useAIAgents() {
  const { mutate: swrMutate } = useSWRConfig()
  const result = useSWR<AIAgent[]>(AI_AGENT_KEYS.list(), () => aiAgentsService.list())

  function mutateAgents() {
    swrMutate(AI_AGENT_MATCH.any)
  }

  return {
    agents: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutateAgents,
  }
}

// The registries page accesses ad-hoc fields (e.g. `registries.schemas`); we
// preserve the loose shape rather than locking down a type that callers would
// have to fight. The endpoint returns an object, not an array.
export function useRegistries() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useSWR<any>(AI_AGENT_KEYS.registries(), () => aiAgentsService.listRegistries())
}
