import useSWR from 'swr';

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('API error');
    return r.json();
  });

export function useArtifacts(clientId: string, processId: string) {
  const key = clientId && processId
    ? `/api/clients/${clientId}/processes/${processId}/artifacts`
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, fetcher);

  return {
    artifacts: data ?? [],
    isLoading,
    error,
    mutateArtifacts: mutate,
  };
}
