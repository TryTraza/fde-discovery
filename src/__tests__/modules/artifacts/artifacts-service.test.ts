import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
import { artifactsService } from '@/modules/artifacts/services/artifacts-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>

describe('artifactsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('list GETs the nested artifacts endpoint', async () => {
    mockGet.mockResolvedValue([])
    await artifactsService.list('client-1', 'process-1')
    expect(mockGet).toHaveBeenCalledWith('/api/clients/client-1/processes/process-1/artifacts')
  })

  it('getDownloadUrl GETs single artifact endpoint', async () => {
    mockGet.mockResolvedValue({ downloadUrl: 'https://x' })
    const res = await artifactsService.getDownloadUrl('c', 'p', 'a')
    expect(mockGet).toHaveBeenCalledWith('/api/clients/c/processes/p/artifacts/a')
    expect(res).toEqual({ downloadUrl: 'https://x' })
  })

  it('delete DELETEs single artifact endpoint', async () => {
    mockDelete.mockResolvedValue(null)
    await artifactsService.delete('c', 'p', 'a')
    expect(mockDelete).toHaveBeenCalledWith('/api/clients/c/processes/p/artifacts/a')
  })

  it('upload uses fetch with FormData (multipart) — returns parsed body', async () => {
    const fakeFile = new File(['hi'], 'hello.txt', { type: 'text/plain' })
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'art-1', filename: 'hello.txt' }),
    } as unknown as Response)

    const result = await artifactsService.upload('c', 'p', fakeFile, 'reference')

    expect(fetch).toHaveBeenCalledWith(
      '/api/clients/c/processes/p/artifacts',
      expect.objectContaining({ method: 'POST' })
    )
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('stage')).toBe('reference')
    expect((init.body as FormData).get('file')).toBe(fakeFile)
    expect(result).toEqual({ id: 'art-1', filename: 'hello.txt' })
  })

  it('upload throws an Error with server message on non-ok response', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ error: 'too big' }),
    } as unknown as Response)

    await expect(artifactsService.upload('c', 'p', new File(['x'], 'x'), 'input')).rejects.toThrow(
      'too big'
    )
  })
})
