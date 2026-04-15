import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getAgentBySlugUnfiltered, upsertAgent } from '@/lib/db/queries/ai-agents'
import { parseJSON } from '@/lib/api/utils'
import { layerSpecSchema, toolSpecSchema, resilienceConfigSchema } from '@/lib/ai/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin()
    const { slug } = await params
    const agent = await getAgentBySlugUnfiltered(slug)
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return NextResponse.json(agent)
  } catch (error) {
    return handleAPIError(error)
  }
}

const patchSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  mode: z.enum(['generateObject', 'generateText', 'streamText']).optional(),
  model: z.enum(['fast', 'standard']).optional(),
  layers: z.array(layerSpecSchema).optional(),
  langfusePromptName: z.string().min(1).optional(),
  schemaSlug: z.string().nullable().optional(),
  tools: z.array(toolSpecSchema).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  skills: z.array(z.string()).optional(),
  resilience: resilienceConfigSchema.optional(),
  enabled: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin()
    const { slug } = await params
    const { data, error } = await parseJSON(req)
    if (error) return error

    const parsed = patchSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Load existing agent to merge with patch
    const existing = await getAgentBySlugUnfiltered(slug)
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const merged = {
      slug,
      label: parsed.data.label ?? existing.label,
      description:
        parsed.data.description !== undefined
          ? parsed.data.description
          : (existing.description ?? null),
      mode: parsed.data.mode ?? existing.mode,
      model: parsed.data.model ?? existing.model,
      layers: parsed.data.layers ?? (existing.layers as any[]),
      langfusePromptName: parsed.data.langfusePromptName ?? existing.langfusePromptName,
      schemaSlug:
        parsed.data.schemaSlug !== undefined
          ? parsed.data.schemaSlug
          : (existing.schemaSlug ?? null),
      tools: parsed.data.tools ?? (existing.tools as any[]),
      maxOutputTokens: parsed.data.maxOutputTokens ?? existing.maxOutputTokens,
      skills: parsed.data.skills ?? (existing.skills as string[]),
      resilience: parsed.data.resilience ?? (existing.resilience as any),
      enabled: parsed.data.enabled ?? existing.enabled,
    }

    const agent = await upsertAgent(merged)
    return NextResponse.json(agent)
  } catch (error) {
    return handleAPIError(error)
  }
}
