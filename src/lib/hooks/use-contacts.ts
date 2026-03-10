import useSWR, { useSWRConfig } from 'swr';

export function useContacts(clientId: string | null) {
  const { mutate: swrMutate } = useSWRConfig();
  const key = clientId ? `/api/clients/${clientId}/contacts` : null;
  const result = useSWR(key);

  return {
    ...result,
    contacts: result.data ?? [],
    mutateContacts: () => {
      if (clientId) {
        swrMutate(`/api/clients/${clientId}/contacts`);
      }
    },
  };
}
