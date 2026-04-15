import { eq, and, isNull, inArray, asc } from 'drizzle-orm'
import { db } from '../index'
import { skills, type NewSkillRow } from '../schema'

const notDeleted = isNull(skills.deletedAt)

export async function createSkill(data: {
  slug: string
  label: string
  type: 'system-prompt' | 'context-enrichment' | 'instruction'
  content: string
  description?: string | null
}) {
  const [skill] = await db
    .insert(skills)
    .values({
      slug: data.slug,
      label: data.label,
      type: data.type,
      content: data.content,
      description: data.description ?? null,
    })
    .returning()
  return skill
}

export async function listSkills() {
  return db.select().from(skills).where(notDeleted).orderBy(asc(skills.label))
}

export async function getSkillsBySlugs(slugs: string[]) {
  if (slugs.length === 0) return []

  return db
    .select()
    .from(skills)
    .where(and(inArray(skills.slug, slugs), eq(skills.enabled, true), notDeleted))
}

export async function updateSkill(
  id: string,
  data: Partial<
    Pick<NewSkillRow, 'label' | 'slug' | 'description' | 'type' | 'content' | 'enabled'>
  >
) {
  const [skill] = await db
    .update(skills)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(skills.id, id), notDeleted))
    .returning()
  return skill
}

export async function softDeleteSkill(id: string) {
  const [skill] = await db
    .update(skills)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(skills.id, id), notDeleted))
    .returning()
  return skill
}
