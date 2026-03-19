import useSWR from 'swr';

export function useSessions(processId: string | null) {
  const key = processId ? `/api/sessions?processId=${processId}` : null;
  const result = useSWR(key);

  return {
    ...result,
    sessions: result.data ?? [],
    isLoading: result.isLoading,
    mutateSessions: result.mutate,
  };
}

export function useSession(sessionId: string | null) {
  const key = sessionId ? `/api/sessions/${sessionId}` : null;
  const result = useSWR(key);

  return {
    ...result,
    session: result.data ?? null,
    isLoading: result.isLoading,
    mutateSession: result.mutate,
  };
}
