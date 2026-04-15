import { vi } from 'vitest'

// Server-side mocks (for API route tests)
export const mockAuth = vi.fn()
export const mockClerkClient = vi.fn()
export const mockCurrentUser = vi.fn()

export function setupClerkMocks(overrides?: {
  isAuthenticated?: boolean
  userId?: string
  publicMetadata?: Record<string, unknown>
  privateMetadata?: Record<string, unknown>
}) {
  const {
    isAuthenticated = true,
    userId = 'user_test123',
    publicMetadata = {},
    privateMetadata = {},
  } = overrides ?? {}

  mockAuth.mockResolvedValue({
    isAuthenticated,
    userId: isAuthenticated ? userId : null,
    redirectToSignIn: vi.fn(),
  })

  const mockGetUser = vi.fn().mockResolvedValue({
    id: userId,
    publicMetadata,
    privateMetadata,
  })

  const mockUpdateUserMetadata = vi.fn().mockResolvedValue({})

  mockClerkClient.mockResolvedValue({
    users: {
      getUser: mockGetUser,
      updateUserMetadata: mockUpdateUserMetadata,
    },
  })

  return { mockGetUser, mockUpdateUserMetadata }
}
