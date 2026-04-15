import 'server-only'
import { put, del, get } from '@vercel/blob'
import { env } from '@/lib/env'

export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const key = `${bucket}/${path}`
  const blob = await put(key, file, {
    access: 'private',
    contentType,
    token: env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  })
  return blob.pathname
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const key = path.startsWith(`${bucket}/`) ? path : `${bucket}/${path}`
  await del(key, { token: env.BLOB_READ_WRITE_TOKEN })
}

export async function getFileStream(
  bucket: string,
  path: string
): Promise<{ stream: ReadableStream; contentType: string | null } | null> {
  const key = path.startsWith(`${bucket}/`) ? path : `${bucket}/${path}`
  const result = await get(key, {
    access: 'private',
    token: env.BLOB_READ_WRITE_TOKEN,
  })
  if (!result) return null
  return {
    stream: result.stream,
    contentType: result.headers.get('content-type'),
  }
}
