import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireUserId, handleAPIError } from '@/lib/auth/utils'
import { getArtifactById } from '@/lib/db/queries/artifacts'
import { getBlobUrl } from '@/lib/storage/blob'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string; artifactId: string }> }
) {
  try {
    await requireUserId()
    const { artifactId } = await params
    const artifact = await getArtifactById(artifactId)

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
    }

    const blobUrl = await getBlobUrl('artifacts', artifact.storagePath)
    const upstream = await fetch(blobUrl)

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Failed to fetch artifact' }, { status: 502 })
    }

    return new Response(upstream.body, {
      headers: {
        'content-type': upstream.headers.get('content-type') ?? artifact.mimeType ?? 'application/octet-stream',
        'content-disposition': `inline; filename="${artifact.filename}"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    return handleAPIError(error)
  }
}
