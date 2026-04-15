import useSWR, { useSWRConfig } from 'swr'
import { skillsService, type Skill } from '@/modules/ai/services/skills-service'
import { SKILL_KEYS, SKILL_MATCH } from '@/modules/ai/lib/swr-keys'

export function useSkills() {
  const { mutate: swrMutate } = useSWRConfig()
  const result = useSWR<Skill[]>(SKILL_KEYS.list(), () => skillsService.list())

  function mutateSkills() {
    swrMutate(SKILL_MATCH.any)
  }

  return {
    skills: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutateSkills,
  }
}
