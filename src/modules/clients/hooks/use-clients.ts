import useSWR, { useSWRConfig } from 'swr'
import { clientsService } from '@/modules/clients/services/clients-service'
import { CLIENT_KEYS, CLIENT_MATCH } from '@/modules/clients/lib/swr-keys'
import type { Client, ClientFilters } from '@/modules/clients/types'

export function useClients(filters?: ClientFilters) {
  const { mutate: swrMutate } = useSWRConfig()
  const effectiveFilters = filters ?? {}
  const key = CLIENT_KEYS.list(effectiveFilters)

  const result = useSWR<Client[]>(key, () => clientsService.list(effectiveFilters))

  return {
    ...result,
    clients: result.data ?? [],
    // Function matcher — revalidates ALL keys under /api/clients (list, detail, contacts).
    // After creating/deleting a client, the detail page and contacts cache should also refresh.
    // Do NOT narrow this matcher without understanding cross-key dependencies.
    mutateClients: () =>
      swrMutate(CLIENT_MATCH.allRelated, undefined, { revalidate: true }),
  }
}

export function useClient(id: string | null) {
  const key = id ? CLIENT_KEYS.detail(id) : null
  const result = useSWR<Client>(key, id ? () => clientsService.getById(id) : null)
  return {
    ...result,
    client: result.data ?? null,
    mutateClient: result.mutate,
  }
}
