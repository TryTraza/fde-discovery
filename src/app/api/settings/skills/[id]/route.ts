import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { updateSkill, softDeleteSkill } from '@/lib/db/queries/skills'
import { parseJSON } from '@/lib/api/utils'

const updateSkillSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  label: z.string().min(1).optional(),
  type: z.enum(['system-prompt', 'context-enrichment', 'instruction']).optional(),
  content: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { data, error } = await parseJSON(req)
    if (error) return error

    const parsed = updateSkillSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const skill = await updateSkill(id, parsed.data)
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }
    return NextResponse.json(skill)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    const skill = await softDeleteSkill(id)
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAPIError(error)
  }
}
