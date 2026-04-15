import useSWR from 'swr'
import {
  sessionsService,
  type SessionRecord,
} from '@/modules/sessions/services/sessions-service'
import { SESSION_KEYS } from '@/modules/sessions/lib/swr-keys'

export function useSessions(processId: string | null) {
  const enabled = Boolean(processId)
  const key = enabled ? SESSION_KEYS.listForProcess(processId!) : null
  const result = useSWR<SessionRecord[]>(
    key,
    enabled ? () => sessionsService.listForProcess(processId!) : null
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
