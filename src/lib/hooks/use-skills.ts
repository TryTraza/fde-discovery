import useSWR, { useSWRConfig } from 'swr';

export function useSkills() {
  const { mutate: swrMutate } = useSWRConfig();

  const result = useSWR('/api/settings/skills');

  const mutateSkills = () => {
    swrMutate((key: string) => typeof key === 'string' && key.startsWith('/api/settings/skills'));
  };

  return {
    skills: result.data as any[] | undefined,
    isLoading: result.isLoading,
    error: result.error,
    mutateSkills,
  };
}
