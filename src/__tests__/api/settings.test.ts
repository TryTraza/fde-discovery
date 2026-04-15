// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

import { GET, PATCH } from '@/app/api/settings/route'

describe('GET /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns hasApiKey and role when authenticated (no aiModels after Phase 2.5)', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-test' },
      publicMetadata: { role: 'admin' },
    })
    const res = await GET()
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.hasApiKey).toBe(true)
    expect(data.role).toBe('admin')
    expect(data).not.toHaveProperty('aiModels')
  })

  it('does NOT return raw API key in response', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-secret123' },
    })
    const res = await GET()
    const text = JSON.stringify(await res.json())
    expect(text).not.toContain('sk-ant-secret123')
  })

  it('returns sensible defaults for fresh user', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: {},
      publicMetadata: {},
    })
    const res = await GET()
    const data = await res.json()
    expect(data.hasApiKey).toBe(false)
    expect(data.role).toBe('viewer')
    expect(data).not.toHaveProperty('aiModels')
  })
})

describe('PATCH /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ anthropicApiKey: 'sk-ant-test' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('saves API key and sets hasApiKey in metadata', async () => {
    const { mockUpdateUserMetadata } = setupClerkMocks({ isAuthenticated: true })
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ anthropicApiKey: 'sk-ant-test123' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_test123', {
      privateMetadata: { anthropicApiKey: 'sk-ant-test123' },
      publicMetadata: { hasApiKey: true },
    })
  })

  it('rejects aiModels patches (field removed in Phase 2.5)', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ aiModels: { research: 'claude-sonnet-4-6' } }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
  })

  it('returns 422 on empty body', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
  })

  it('returns 422 on invalid body shape', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ anthropicApiKey: '' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
  })
})
