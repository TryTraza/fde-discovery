import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getArtifactById, softDeleteArtifact } from '@/lib/db/queries/artifacts'
import { deleteFile } from '@/lib/storage/blob'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string; artifactId: string }> }
) {
  try {
    await requireUserId()
    const { id, processId, artifactId } = await params
    const artifact = await getArtifactById(artifactId)

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
    }

    const downloadUrl = new URL(
      `/api/clients/${id}/processes/${processId}/artifacts/${artifactId}/download`,
      req.url
    ).toString()
    return NextResponse.json({ ...artifact, downloadUrl })
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string; artifactId: string }> }
) {
  try {
    await requireAdmin()
    const { artifactId } = await params
    const artifact = await getArtifactById(artifactId)

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
    }

    await softDeleteArtifact(artifactId)
    await deleteFile('artifacts', artifact.storagePath).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAPIError(error)
  }
}
