import useSWR from 'swr';

export function useProcesses(clientId: string | null) {
  const key = clientId ? `/api/clients/${clientId}/processes` : null;
  const result = useSWR(key);

  return {
    ...result,
    processes: result.data ?? [],
    mutateProcesses: result.mutate,
  };
}

export function useProcess(clientId: string, processId: string) {
  const key =
    clientId && processId
      ? `/api/clients/${clientId}/processes/${processId}`
      : null;
  const result = useSWR(key, {
    revalidateOnFocus: false,
  });

  return {
    ...result,
    process: result.data ?? null,
    mutateProcess: result.mutate,
  };
}
