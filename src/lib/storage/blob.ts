import 'server-only'
import { put, del, head } from '@vercel/blob'
import { env } from '@/lib/env'

export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const key = `${bucket}/${path}`
  const blob = await put(key, file, {
    access: 'public',
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

// Returns the blob's canonical URL. Caller must NOT leak it to clients —
// route handlers should stream the bytes through the API after authorization.
export async function getBlobUrl(bucket: string, path: string): Promise<string> {
  const key = path.startsWith(`${bucket}/`) ? path : `${bucket}/${path}`
  const meta = await head(key, { token: env.BLOB_READ_WRITE_TOKEN })
  return meta.url
}

export const getSignedUrl = getBlobUrl
