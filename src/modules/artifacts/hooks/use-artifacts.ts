import useSWR from 'swr'
import { artifactsService, type Artifact } from '@/modules/artifacts/services/artifacts-service'
import { ARTIFACT_KEYS } from '@/modules/artifacts/lib/swr-keys'

export function useArtifacts(clientId: string, processId: string) {
  const enabled = Boolean(clientId && processId)
  const key = enabled ? ARTIFACT_KEYS.list(clientId, processId) : null

  const { data, error, isLoading, mutate } = useSWR<Artifact[]>(
    key,
    enabled ? () => artifactsService.list(clientId, processId) : null
  )

  return {
    artifacts: data ?? [],
    isLoading,
    error,
    mutateArtifacts: mutate,
  }
}
