import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs BEFORE importing the resolver so its module-level fn binding
// sees the mocked version.
const mockReadFileSync = vi.fn()
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    default: { ...actual, readFileSync: (...args: unknown[]) => mockReadFileSync(...args) },
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  }
})

import { resolveSkills } from '@/lib/ai/skills/resolver'
import { EMPTY_SKILLS } from '@/lib/ai/types'

function enoent(): Error {
  const err = new Error('ENOENT: no such file') as NodeJS.ErrnoException
  err.code = 'ENOENT'
  return err
}

function skillFile(args: { slug: string; type: string; body: string; label?: string }): string {
  const header = [
    '---',
    `slug: ${args.slug}`,
    `label: ${JSON.stringify(args.label ?? args.slug)}`,
    `type: ${args.type}`,
    '---',
    '',
  ].join('\n')
  return `${header}${args.body}\n`
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReadFileSync.mockImplementation(() => {
    throw enoent()
  })
})

describe('resolveSkills', () => {
  it('returns EMPTY_SKILLS for empty slugs (no FS read)', async () => {
    const result = await resolveSkills([])
    expect(result).toEqual(EMPTY_SKILLS)
    expect(mockReadFileSync).not.toHaveBeenCalled()
  })

  it('reads a system-prompt skill from the filesystem', async () => {
    mockReadFileSync.mockReturnValueOnce(
      skillFile({ slug: 'process-archaeology', type: 'system-prompt', body: 'Archaeology content' })
    )

    const result = await resolveSkills(['process-archaeology'])
    expect(result.systemPromptFragments).toContain('Archaeology content')
  })

  it('groups multiple skills by their type', async () => {
    mockReadFileSync.mockImplementation((path: unknown) => {
      if (String(path).endsWith('a.md')) {
        return skillFile({ slug: 'a', type: 'system-prompt', body: 'System A' })
      }
      if (String(path).endsWith('b.md')) {
        return skillFile({ slug: 'b', type: 'instruction', body: 'Instruction B' })
      }
      throw enoent()
    })

    const result = await resolveSkills(['a', 'b'])
    expect(result.systemPromptFragments).toEqual(['System A'])
    expect(result.instructions).toEqual(['Instruction B'])
  })

  it('parses context-enrichment key=value pairs from disk', async () => {
    mockReadFileSync.mockReturnValueOnce(
      skillFile({ slug: 'ctx-1', type: 'context-enrichment', body: 'key1=value1\nkey2=value2' })
    )
    const result = await resolveSkills(['ctx-1'])
    expect(result.contextEnrichments).toEqual({ key1: 'value1', key2: 'value2' })
  })

  it('returns EMPTY_SKILLS when no slug is found on disk', async () => {
    const result = await resolveSkills(['nonexistent'])
    expect(result).toEqual(EMPTY_SKILLS)
  })

  it('skips malformed context-enrichment lines (no =)', async () => {
    mockReadFileSync.mockReturnValueOnce(
      skillFile({ slug: 'bad', type: 'context-enrichment', body: 'no-equals-here\nkey=value' })
    )
    const result = await resolveSkills(['bad'])
    expect(result.contextEnrichments).toEqual({ key: 'value' })
  })

  it('skips files missing the type in frontmatter', async () => {
    mockReadFileSync.mockReturnValueOnce('---\nslug: broken\n---\nbody\n')
    const result = await resolveSkills(['broken'])
    expect(result).toEqual(EMPTY_SKILLS)
  })
})
