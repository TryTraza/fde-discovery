import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockPathname = vi.fn().mockReturnValue('/clients')

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
  redirect: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUser: vi.fn().mockReturnValue({
    user: {
      fullName: 'Test User',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
    },
  }),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}))

const mockClientData = { name: 'Acme Corp', id: 'c1000000-0000-0000-0000-000000000001' }
const mockProcessData = { name: 'Purchasing', id: 'a2000000-0000-0000-0000-000000000002' }

vi.mock('swr', () => {
  const useSWR = (key: string | null) => {
    if (!key) return { data: null }
    // Process key contains both /clients/ and /processes/ — must check process first
    if (key.match(/\/processes\/[^/]+$/)) return { data: mockProcessData }
    if (key.match(/\/clients\/[^/]+$/)) return { data: mockClientData }
    return { data: null }
  }
  return { default: useSWR, __esModule: true }
})

import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

function renderSidebar() {
  return render(
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <AppSidebar />
      </SidebarProvider>
    </TooltipProvider>
  )
}

describe('Contextual sidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/clients')
  })

  it('at /clients shows no contextual section', () => {
    mockPathname.mockReturnValue('/clients')
    renderSidebar()
    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
  })

  it('at /clients/[uuid] shows client context with sub-links', () => {
    mockPathname.mockReturnValue('/clients/c1000000-0000-0000-0000-000000000001')
    renderSidebar()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Processes')).toBeInTheDocument()
  })

  it('at /clients/[uuid]/processes shows client context with Processes active', () => {
    mockPathname.mockReturnValue('/clients/c1000000-0000-0000-0000-000000000001/processes')
    renderSidebar()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Processes')).toBeInTheDocument()
  })

  it('at /clients/[uuid]/processes/[uuid] shows both client AND process context stacked', () => {
    mockPathname.mockReturnValue(
      '/clients/c1000000-0000-0000-0000-000000000001/processes/a2000000-0000-0000-0000-000000000002'
    )
    renderSidebar()
    // Client section
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('All Clients')).toBeInTheDocument()
    // Process section
    expect(screen.getByText('Purchasing')).toBeInTheDocument()
    expect(screen.getByText('All Processes')).toBeInTheDocument()
    // Both have Overview links
    expect(screen.getAllByText('Overview')).toHaveLength(2)
  })

  it('client context has back link to clients list', () => {
    mockPathname.mockReturnValue('/clients/c1000000-0000-0000-0000-000000000001')
    renderSidebar()
    const backLink = screen.getByText('All Clients')
    expect(backLink.closest('a')).toHaveAttribute('href', '/clients')
  })

  it('process context has back link to processes list', () => {
    mockPathname.mockReturnValue(
      '/clients/c1000000-0000-0000-0000-000000000001/processes/a2000000-0000-0000-0000-000000000002'
    )
    renderSidebar()
    const backLink = screen.getByText('All Processes')
    expect(backLink.closest('a')).toHaveAttribute(
      'href',
      '/clients/c1000000-0000-0000-0000-000000000001/processes'
    )
  })
})
