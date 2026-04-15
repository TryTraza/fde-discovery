import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getSkillsBySlugs } from '@/lib/db/queries/skills'
import { EMPTY_SKILLS, type ResolvedSkills } from '@/lib/ai/types'

const SKILLS_DIR = join(process.cwd(), 'src/lib/ai/skills')

export const SKILL_TYPES = {
  SYSTEM_PROMPT: 'system-prompt',
  INSTRUCTION: 'instruction',
  CONTEXT_ENRICHMENT: 'context-enrichment',
} as const
export type SkillType = (typeof SKILL_TYPES)[keyof typeof SKILL_TYPES]

interface Skill {
  slug: string
  type: SkillType
  content: string
}

interface Frontmatter {
  slug?: string
  type?: string
  label?: string
  description?: string
}

function parseFrontmatter(raw: string): { front: Frontmatter; body: string } {
  if (!raw.startsWith('---\n')) return { front: {}, body: raw }
  const end = raw.indexOf('\n---\n', 4)
  if (end === -1) return { front: {}, body: raw }
  const frontBlock = raw.slice(4, end)
  const body = raw.slice(end + 5)

  const front: Frontmatter = {}
  for (const line of frontBlock.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value) as string
      } catch {
        /* keep raw */
      }
    }
    front[key as keyof Frontmatter] = value
  }
  return { front, body }
}

function readSkillFromFs(slug: string): Skill | null {
  try {
    const raw = readFileSync(join(SKILLS_DIR, `${slug}.md`), 'utf8')
    const { front, body } = parseFrontmatter(raw)
    if (!front.type) {
      console.warn(`[AI] Skill "${slug}": missing frontmatter.type — skipping`)
      return null
    }
    return { slug, type: front.type as SkillType, content: body.trim() }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    console.warn(`[AI] Failed to read skill "${slug}" from disk:`, err)
    return null
  }
}

async function readSkillsFromDb(slugs: string[]): Promise<Skill[]> {
  try {
    const rows = await getSkillsBySlugs(slugs)
    return rows.map((r) => ({ slug: r.slug, type: r.type as SkillType, content: r.content }))
  } catch (err) {
    console.warn('[AI] Failed to read skills from DB:', err)
    return []
  }
}

function applySkills(skills: Skill[]): ResolvedSkills {
  const systemPromptFragments: string[] = []
  const contextEnrichments: Record<string, string> = {}
  const instructions: string[] = []

  for (const skill of skills) {
    switch (skill.type) {
      case SKILL_TYPES.SYSTEM_PROMPT:
        systemPromptFragments.push(skill.content)
        break
      case SKILL_TYPES.INSTRUCTION:
        instructions.push(skill.content)
        break
      case SKILL_TYPES.CONTEXT_ENRICHMENT:
        for (const line of skill.content.split('\n')) {
          const eqIndex = line.indexOf('=')
          if (eqIndex === -1) {
            console.warn(
              `[AI] Skill "${skill.slug}": malformed context-enrichment line (no '='): "${line}"`
            )
            continue
          }
          const key = line.slice(0, eqIndex).trim()
          const value = line.slice(eqIndex + 1).trim()
          if (key) contextEnrichments[key] = value
        }
        break
    }
  }

  return { systemPromptFragments, contextEnrichments, instructions }
}

export async function resolveSkills(slugs: string[]): Promise<ResolvedSkills> {
  if (slugs.length === 0) return EMPTY_SKILLS

  // 1. Try filesystem for every slug.
  const fromFs: Skill[] = []
  const missingFromFs: string[] = []
  for (const slug of slugs) {
    const skill = readSkillFromFs(slug)
    if (skill) fromFs.push(skill)
    else missingFromFs.push(slug)
  }

  // 2. For anything missing on disk, fall back to the DB.
  //    This keeps the old admin UI editable during the transition.
  let fromDb: Skill[] = []
  if (missingFromFs.length > 0) {
    fromDb = await readSkillsFromDb(missingFromFs)
    const stillMissing = missingFromFs.filter((s) => !fromDb.find((r) => r.slug === s))
    if (stillMissing.length > 0) {
      console.warn(
        `[AI] Skills not found on disk or in DB: ${stillMissing.join(', ')} — skipping`
      )
    }
  }

  const merged = [...fromFs, ...fromDb]
  if (merged.length === 0) return EMPTY_SKILLS

  return applySkills(merged)
}
