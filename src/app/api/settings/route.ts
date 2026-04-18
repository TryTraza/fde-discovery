import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { requireUserId, handleAPIError } from '@/lib/auth/utils'
import { z } from 'zod'

export async function GET() {
  try {
    const userId = await requireUserId()

    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    return NextResponse.json({
      hasApiKey: !!(user.privateMetadata as Record<string, unknown>)?.anthropicApiKey,
      role: (user.publicMetadata as Record<string, unknown>)?.role ?? 'viewer',
    })
  } catch (error) {
    return handleAPIError(error)
  }
}

const patchSettingsSchema = z.object({
  anthropicApiKey: z.string().min(1),
})

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId()

    const body = await req.json()
    const parsed = patchSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 422 })
    }

    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { anthropicApiKey: parsed.data.anthropicApiKey },
      publicMetadata: { hasApiKey: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAPIError(error)
  }
}
