// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/artifacts', () => ({
  createArtifact: vi.fn(),
  listArtifactsByProcess: vi.fn(),
  getArtifactById: vi.fn(),
  softDeleteArtifact: vi.fn(),
}))

vi.mock('@/lib/storage/blob', () => ({
  uploadFile: vi.fn().mockResolvedValue('artifacts/process-1/abc-file.pdf'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getFileStream: vi.fn().mockResolvedValue({
    stream: new ReadableStream(),
    contentType: 'application/pdf',
  }),
}))

// --- Imports ---

import {
  GET as listArtifacts,
  POST as uploadArtifact,
} from '@/app/api/clients/[id]/processes/[processId]/artifacts/route'
import {
  GET as getArtifact,
  DELETE as deleteArtifact,
} from '@/app/api/clients/[id]/processes/[processId]/artifacts/[artifactId]/route'
import {
  createArtifact,
  listArtifactsByProcess,
  getArtifactById,
  softDeleteArtifact,
} from '@/lib/db/queries/artifacts'
import { uploadFile, deleteFile } from '@/lib/storage/blob'

// --- Helpers ---

const ADMIN_META = {
  publicMetadata: { role: 'admin' },
  privateMetadata: { anthropicApiKey: 'sk-ant-test-key' },
}

function listParams(processId: string) {
  return { params: Promise.resolve({ id: 'c1', processId }) }
}

function detailParams(processId: string, artifactId: string) {
  return { params: Promise.resolve({ id: 'c1', processId, artifactId }) }
}

const MOCK_ARTIFACT = {
  id: 'a1',
  processId: 'p1',
  sessionId: null,
  filename: 'test.pdf',
  storagePath: 'p1/abc-test.pdf',
  fileSizeBytes: 1024,
  mimeType: 'application/pdf',
  stage: 'reference',
  confirmed: false,
  sourceDescription: null,
  label: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

// --- Tests ---

describe('Artifacts API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/clients/[id]/processes/[processId]/artifacts', () => {
    it('returns 401 if not authenticated', async () => {
      setupClerkMocks({ isAuthenticated: false })
      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts')
      const res = await listArtifacts(req, listParams('p1'))
      expect(res.status).toBe(401)
    })

    it('returns artifacts for process', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
      vi.mocked(listArtifactsByProcess).mockResolvedValue([MOCK_ARTIFACT] as any)

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts')
      const res = await listArtifacts(req, listParams('p1'))
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].filename).toBe('test.pdf')
    })
  })

  describe('POST /api/clients/[id]/processes/[processId]/artifacts', () => {
    it('returns 403 for viewer role', async () => {
      setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }))

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts', {
        method: 'POST',
        body: formData,
      })
      const res = await uploadArtifact(req, listParams('p1'))
      expect(res.status).toBe(403)
    })

    it('returns 400 if no file in form data', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
      const formData = new FormData()

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts', {
        method: 'POST',
        body: formData,
      })
      const res = await uploadArtifact(req, listParams('p1'))
      expect(res.status).toBe(400)
    })

    it('stores file via uploadFile and creates artifact DB record', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
      vi.mocked(createArtifact).mockResolvedValue(MOCK_ARTIFACT as any)

      const file = new File(['test content'], 'report.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('stage', 'reference')

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts', {
        method: 'POST',
        body: formData,
      })
      const res = await uploadArtifact(req, listParams('p1'))
      expect(res.status).toBe(201)

      expect(uploadFile).toHaveBeenCalledWith(
        'artifacts',
        expect.stringContaining('p1/'),
        expect.any(Buffer),
        'application/pdf'
      )
      expect(createArtifact).toHaveBeenCalled()
    })

    it('passes correct schema fields to createArtifact', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
      vi.mocked(createArtifact).mockResolvedValue(MOCK_ARTIFACT as any)

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('stage', 'reference')

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts', {
        method: 'POST',
        body: formData,
      })
      await uploadArtifact(req, listParams('p1'))

      expect(createArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          processId: 'p1',
          filename: 'test.pdf',
          storagePath: expect.any(String),
          fileSizeBytes: expect.any(Number),
          mimeType: 'application/pdf',
          stage: 'reference',
        })
      )
      // Must NOT contain createdBy — schema has no such column
      expect(createArtifact).toHaveBeenCalledWith(
        expect.not.objectContaining({ createdBy: expect.anything() })
      )
    })

    it('returns 400 if file exceeds 25MB', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })

      // Create a file object with size > 25MB
      const bigContent = new Uint8Array(26 * 1024 * 1024)
      const file = new File([bigContent], 'huge.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts', {
        method: 'POST',
        body: formData,
      })
      const res = await uploadArtifact(req, listParams('p1'))
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toContain('25MB')
    })
  })

  describe('GET /api/clients/[id]/processes/[processId]/artifacts/[artifactId]', () => {
    it('returns artifact with a same-origin proxied downloadUrl', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
      vi.mocked(getArtifactById).mockResolvedValue(MOCK_ARTIFACT as any)

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts/a1')
      const res = await getArtifact(req, detailParams('p1', 'a1'))
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.downloadUrl).toBe(
        'http://localhost/api/clients/c1/processes/p1/artifacts/a1/download'
      )
    })

    it('returns 404 for nonexistent artifact', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
      vi.mocked(getArtifactById).mockResolvedValue(null)

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts/nope')
      const res = await getArtifact(req, detailParams('p1', 'nope'))
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/clients/[id]/processes/[processId]/artifacts/[artifactId]', () => {
    it('returns 403 for viewer role', async () => {
      setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts/a1', {
        method: 'DELETE',
      })
      const res = await deleteArtifact(req, detailParams('p1', 'a1'))
      expect(res.status).toBe(403)
    })

    it('soft-deletes artifact record and removes from storage', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
      vi.mocked(getArtifactById).mockResolvedValue(MOCK_ARTIFACT as any)
      vi.mocked(softDeleteArtifact).mockResolvedValue(MOCK_ARTIFACT as any)

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts/a1', {
        method: 'DELETE',
      })
      const res = await deleteArtifact(req, detailParams('p1', 'a1'))
      expect(res.status).toBe(200)

      expect(softDeleteArtifact).toHaveBeenCalledWith('a1')
      expect(deleteFile).toHaveBeenCalledWith('artifacts', 'p1/abc-test.pdf')
    })

    it('returns 404 for nonexistent artifact', async () => {
      setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
      vi.mocked(getArtifactById).mockResolvedValue(null)

      const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts/a1', {
        method: 'DELETE',
      })
      const res = await deleteArtifact(req, detailParams('p1', 'a1'))
      expect(res.status).toBe(404)
    })
  })
})
