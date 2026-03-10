import useSWR, { useSWRConfig } from 'swr';

interface ClientFilters {
  search?: string;
  status?: string;
  industry?: string;
}

export function useClients(filters?: ClientFilters) {
  // useSWRConfig().mutate supports function matchers; globalMutate does NOT
  const { mutate: swrMutate } = useSWRConfig();

  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.industry) params.set('industry', filters.industry);

  const key = `/api/clients?${params.toString()}`;
  const result = useSWR(key);

  return {
    ...result,
    clients: result.data ?? [],
    mutateClients: () => swrMutate(
      // Function matcher — revalidates ALL keys starting with /api/clients
      // This intentionally over-revalidates: it also hits /api/clients/{id} and
      // /api/clients/{id}/contacts keys. This is correct — after creating/deleting
      // a client, the detail page and contacts cache should also refresh.
      // Do NOT narrow this matcher without understanding cross-key dependencies.
      (k) => typeof k === 'string' && k.startsWith('/api/clients'),
      undefined,
      { revalidate: true }
    ),
  };
}

export function useClient(id: string | null) {
  const result = useSWR(id ? `/api/clients/${id}` : null);
  return {
    ...result,
    client: result.data ?? null,
    mutateClient: result.mutate,
  };
}
