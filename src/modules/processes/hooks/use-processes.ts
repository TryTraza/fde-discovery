import useSWR from 'swr'
import { processesService } from '@/modules/processes/services/processes-service'
import { PROCESS_KEYS } from '@/modules/processes/lib/swr-keys'

// The process record carries a sprawling JSONB `processModel` field plus
// many optional columns (hypothesisText, processTypeL1, openQuestions, ...).
// Pre-refactor the hook returned `any`; downstream components rely on that
// loose access. We keep the same shape rather than locking down a type that
// every consumer would need to fight.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseProcess = any

export function useProcesses(clientId: string | null) {
  const enabled = Boolean(clientId)
  const key = enabled ? PROCESS_KEYS.list(clientId!) : null
  const result = useSWR<LooseProcess[]>(
    key,
    enabled ? () => processesService.list(clientId!) as Promise<LooseProcess[]> : null
  )

  return {
    ...result,
    processes: result.data ?? [],
    mutateProcesses: result.mutate,
  }
}

export function useProcess(clientId: string, processId: string) {
  const enabled = Boolean(clientId && processId)
  const key = enabled ? PROCESS_KEYS.detail(clientId, processId) : null
  const result = useSWR<LooseProcess>(
    key,
    enabled
      ? () => processesService.getById(clientId, processId) as Promise<LooseProcess>
      : null,
    { revalidateOnFocus: false }
  )

  return {
    ...result,
    process: result.data ?? null,
    mutateProcess: result.mutate,
  }
}
