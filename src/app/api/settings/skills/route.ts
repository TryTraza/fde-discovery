import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { createSkill, listSkills } from '@/lib/db/queries/skills';
import { parseJSON } from '@/lib/api/utils';

const createSkillSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  type: z.enum(['system-prompt', 'context-enrichment', 'instruction']),
  content: z.string().min(1),
  description: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const skills = await listSkills();
    return NextResponse.json(skills);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { data, error } = await parseJSON(req);
    if (error) return error;

    const parsed = createSkillSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const skill = await createSkill(parsed.data);
      return NextResponse.json(skill, { status: 201 });
    } catch (err: any) {
      if (err?.code === '23505') {
        return NextResponse.json(
          { error: `Skill with slug "${parsed.data.slug}" already exists` },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    return handleAPIError(error);
  }
}
