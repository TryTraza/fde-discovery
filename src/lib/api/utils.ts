import { NextResponse } from 'next/server'

export async function parseJSON(
  request: Request
): Promise<{ data?: unknown; error?: NextResponse }> {
  try {
    const data = await request.json()
    return { data }
  } catch {
    return {
      error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    }
  }
}
