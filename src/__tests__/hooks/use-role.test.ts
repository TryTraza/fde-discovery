// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(),
}))

import { useUser } from '@clerk/nextjs'
import { useRole } from '@/lib/hooks/use-role'

describe('useRole', () => {
  it('returns isAdmin: true when role is admin', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { publicMetadata: { role: 'admin', hasApiKey: true } },
    } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isViewer).toBe(false)
    expect(result.current.hasApiKey).toBe(true)
  })

  it('returns isViewer: true when role is viewer', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { publicMetadata: { role: 'viewer' } },
    } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current.isViewer).toBe(true)
    expect(result.current.isAdmin).toBe(false)
  })

  it('defaults to viewer when no publicMetadata', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { publicMetadata: {} },
    } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current.role).toBe('viewer')
    expect(result.current.isViewer).toBe(true)
  })

  it('defaults to viewer when user is null', () => {
    vi.mocked(useUser).mockReturnValue({ user: null } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current.role).toBe('viewer')
    expect(result.current.isViewer).toBe(true)
    expect(result.current.isAdmin).toBe(false)
  })

  it('returns hasApiKey: false when not set', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { publicMetadata: { role: 'admin' } },
    } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current.hasApiKey).toBe(false)
  })
})
