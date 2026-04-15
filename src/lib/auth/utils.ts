import 'server-only'
import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

/**
 * Fast auth check — session-only, no network call to Clerk API.
 * Use for routes that only need userId.
 */
export async function requireUserId(): Promise<string> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) throw new Error('Unauthorized')
  return userId
}

/**
 * Full auth check — fetches user from Clerk API to read metadata.
 * Use for routes that need role or other metadata.
 */
export async function requireAuthWithUser() {
  const userId = await requireUserId()
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const role = (user.publicMetadata as Record<string, unknown>)?.role ?? 'viewer'
  return { userId, role, user }
}

/**
 * Admin-only gate. Fetches user to verify role.
 */
export async function requireAdmin() {
  const { userId, role } = await requireAuthWithUser()
  if (role !== 'admin') throw new Error('Forbidden: admin role required')
  return { userId, role }
}

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message === 'NO_API_KEY') {
      return NextResponse.json(
        { error: 'No API key configured. Go to Settings to add your Anthropic API key.' },
        { status: 422 }
      )
    }
    if (error.message === 'Forbidden: admin role required') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message.includes('invalid_api_key')) {
      return NextResponse.json(
        { error: 'Invalid API key. Check your key in Settings.' },
        { status: 422 }
      )
    }
    if (error.message.includes('rate_limit')) {
      return NextResponse.json({ error: 'Rate limited. Try again later.' }, { status: 429 })
    }
  }
  console.error('API error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
