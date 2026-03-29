import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { listArtifactsByProcess, createArtifact } from '@/lib/db/queries/artifacts';
import { uploadFile } from '@/lib/supabase/storage';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    await requireUserId();
    const { processId } = await params;
    const artifacts = await listArtifactsByProcess(processId);
    return NextResponse.json(artifacts);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    await requireAdmin();
    const { processId } = await params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const stage = (formData.get('stage') as string) ?? null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${processId}/${randomUUID()}-${file.name}`;
    await uploadFile('artifacts', storagePath, buffer, file.type);

    // Create DB record — use EXACT schema column names
    const artifact = await createArtifact({
      processId,
      filename: file.name,
      storagePath,
      fileSizeBytes: file.size,
      mimeType: file.type,
      stage: stage as any ?? null,
    });

    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
