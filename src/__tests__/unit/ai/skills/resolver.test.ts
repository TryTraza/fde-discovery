import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries/skills', () => ({
  getSkillsBySlugs: vi.fn(),
}))

import { getSkillsBySlugs } from '@/lib/db/queries/skills'
import { resolveSkills } from '@/lib/ai/skills/resolver'
import { EMPTY_SKILLS } from '@/lib/ai/types'

beforeEach(() => vi.clearAllMocks())

describe('resolveSkills', () => {
  it('returns EMPTY_SKILLS for empty slugs (no DB call)', async () => {
    const result = await resolveSkills([])
    expect(result).toEqual(EMPTY_SKILLS)
    expect(getSkillsBySlugs).not.toHaveBeenCalled()
  })

  it('groups system-prompt skill into systemPromptFragments', async () => {
    vi.mocked(getSkillsBySlugs).mockResolvedValue([
      {
        slug: 'process-archaeology',
        type: 'system-prompt',
        content: 'Archaeology content',
        enabled: true,
      },
    ] as any)

    const result = await resolveSkills(['process-archaeology'])
    expect(result.systemPromptFragments).toContain('Archaeology content')
    expect(result.instructions).toHaveLength(0)
  })

  it('groups instruction skill into instructions', async () => {
    vi.mocked(getSkillsBySlugs).mockResolvedValue([
      { slug: 'be-concise', type: 'instruction', content: 'Keep answers short.', enabled: true },
    ] as any)

    const result = await resolveSkills(['be-concise'])
    expect(result.instructions).toContain('Keep answers short.')
    expect(result.systemPromptFragments).toHaveLength(0)
  })

  it('parses context-enrichment key=value pairs', async () => {
    vi.mocked(getSkillsBySlugs).mockResolvedValue([
      {
        slug: 'ctx-1',
        type: 'context-enrichment',
        content: 'key1=value1\nkey2=value2',
        enabled: true,
      },
    ] as any)

    const result = await resolveSkills(['ctx-1'])
    expect(result.contextEnrichments).toEqual({ key1: 'value1', key2: 'value2' })
  })

  it('groups multiple skills by type correctly', async () => {
    vi.mocked(getSkillsBySlugs).mockResolvedValue([
      { slug: 'a', type: 'system-prompt', content: 'System A', enabled: true },
      { slug: 'b', type: 'instruction', content: 'Instruction B', enabled: true },
    ] as any)

    const result = await resolveSkills(['a', 'b'])
    expect(result.systemPromptFragments).toEqual(['System A'])
    expect(result.instructions).toEqual(['Instruction B'])
  })

  it('skips disabled skills (returns empty)', async () => {
    // getSkillsBySlugs already filters by enabled=true, so it returns empty
    vi.mocked(getSkillsBySlugs).mockResolvedValue([])
    const result = await resolveSkills(['disabled-skill'])
    expect(result).toEqual(EMPTY_SKILLS)
  })

  it('handles nonexistent slugs gracefully (returns empty)', async () => {
    vi.mocked(getSkillsBySlugs).mockResolvedValue([])
    const result = await resolveSkills(['nonexistent'])
    expect(result).toEqual(EMPTY_SKILLS)
  })

  it('skips malformed context-enrichment lines (no =)', async () => {
    vi.mocked(getSkillsBySlugs).mockResolvedValue([
      {
        slug: 'bad',
        type: 'context-enrichment',
        content: 'no-equals-here\nkey=value',
        enabled: true,
      },
    ] as any)

    const result = await resolveSkills(['bad'])
    expect(result.contextEnrichments).toEqual({ key: 'value' })
  })
})
