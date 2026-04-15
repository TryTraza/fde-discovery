import useSWR, { useSWRConfig } from 'swr';

export function useAIAgents() {
  const { mutate: swrMutate } = useSWRConfig();
  const result = useSWR('/api/settings/ai-agents');

  const mutateAgents = () => {
    swrMutate((key: string) => typeof key === 'string' && key.startsWith('/api/settings/ai-agents'));
  };

  return {
    agents: result.data as any[] | undefined,
    isLoading: result.isLoading,
    error: result.error,
    mutateAgents,
  };
}

export function useRegistries() {
  return useSWR('/api/settings/registries');
}
