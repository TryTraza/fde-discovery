import useSWR from 'swr'
import { sessionsService, type SessionRecord } from '@/modules/sessions/services/sessions-service'
import { SESSION_KEYS } from '@/modules/sessions/lib/swr-keys'

export function useSessions(clientId: string | null, processId?: string | null) {
  const enabled = Boolean(clientId)
  const key = enabled
    ? SESSION_KEYS.listForClient(clientId!, processId ?? undefined)
    : null
  const result = useSWR<SessionRecord[]>(
    key,
    enabled ? () => sessionsService.listForClient(clientId!, processId ?? undefined) : null
  )

  return {
    ...result,
    sessions: result.data ?? [],
    isLoading: result.isLoading,
    mutateSessions: result.mutate,
  }
}

export function useSession(sessionId: string | null) {
  const enabled = Boolean(sessionId)
  const key = enabled ? SESSION_KEYS.detail(sessionId!) : null
  const result = useSWR<SessionRecord>(
    key,
    enabled ? () => sessionsService.getById(sessionId!) : null
  )

  return {
    ...result,
    session: result.data ?? null,
    isLoading: result.isLoading,
    mutateSession: result.mutate,
  }
}
