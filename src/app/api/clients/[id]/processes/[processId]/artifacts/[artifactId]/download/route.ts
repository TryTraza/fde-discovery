import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireUserId, handleAPIError } from '@/lib/auth/utils'
import { getArtifactById } from '@/lib/db/queries/artifacts'
import { getFileStream } from '@/lib/storage/blob'

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

    const file = await getFileStream('artifacts', artifact.storagePath)
    if (!file) {
      return NextResponse.json({ error: 'Blob not found' }, { status: 404 })
    }

    return new Response(file.stream, {
      headers: {
        'content-type': file.contentType ?? artifact.mimeType ?? 'application/octet-stream',
        'content-disposition': `inline; filename="${artifact.filename}"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    return handleAPIError(error)
  }
}
