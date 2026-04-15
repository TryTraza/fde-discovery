import useSWR, { useSWRConfig } from 'swr'
import { contactsService, type Contact } from '@/modules/contacts/services/contacts-service'
import { CONTACT_KEYS } from '@/modules/contacts/lib/swr-keys'

export function useContacts(clientId: string | null) {
  const { mutate: swrMutate } = useSWRConfig()
  const key = clientId ? CONTACT_KEYS.listForClient(clientId) : null

  const result = useSWR<Contact[]>(
    key,
    clientId ? () => contactsService.listForClient(clientId) : null
  )

  return {
    ...result,
    contacts: result.data ?? [],
    mutateContacts: () => {
      if (clientId) swrMutate(CONTACT_KEYS.listForClient(clientId))
    },
  }
}
