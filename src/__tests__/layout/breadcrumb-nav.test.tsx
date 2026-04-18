import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockPathname = vi.fn().mockReturnValue('/clients')

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockClientData = { name: 'Acme Corp', id: 'c1000000-0000-0000-0000-000000000001' }
const mockProcessData = { name: 'Purchasing', id: 'a2000000-0000-0000-0000-000000000002' }
const mockSessionData = { title: 'Kickoff Call', id: 'b3000000-0000-0000-0000-000000000003' }

vi.mock('swr', () => {
  const useSWR = (key: string | null) => {
    if (!key) return { data: null }
    if (key.match(/\/sessions\/[^/]+$/)) return { data: mockSessionData }
    if (key.match(/\/processes\/[^/]+$/)) return { data: mockProcessData }
    if (key.match(/\/clients\/[^/]+$/)) return { data: mockClientData }
    return { data: null }
  }
  return { default: useSWR, __esModule: true }
})

import { BreadcrumbNav } from '@/components/layout/breadcrumb-nav'

const CLIENT_UUID = 'c1000000-0000-0000-0000-000000000001'
const PROCESS_UUID = 'a2000000-0000-0000-0000-000000000002'
const SESSION_UUID = 'b3000000-0000-0000-0000-000000000003'

describe('BreadcrumbNav', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/clients')
  })

  it('shows "clients" at /clients', () => {
    mockPathname.mockReturnValue('/clients')
    render(<BreadcrumbNav />)
    expect(screen.getByText('clients')).toBeInTheDocument()
  })

  it('resolves client name at /clients/[uuid]', () => {
    mockPathname.mockReturnValue(`/clients/${CLIENT_UUID}`)
    render(<BreadcrumbNav />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('keeps client name resolved at /clients/[uuid]/processes', () => {
    mockPathname.mockReturnValue(`/clients/${CLIENT_UUID}/processes`)
    render(<BreadcrumbNav />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('processes')).toBeInTheDocument()
  })

  it('keeps client name resolved at /clients/[uuid]/processes/[uuid]', () => {
    mockPathname.mockReturnValue(`/clients/${CLIENT_UUID}/processes/${PROCESS_UUID}`)
    render(<BreadcrumbNav />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Purchasing')).toBeInTheDocument()
  })

  it('keeps client name at /clients/[uuid]/sessions', () => {
    mockPathname.mockReturnValue(`/clients/${CLIENT_UUID}/sessions`)
    render(<BreadcrumbNav />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('sessions')).toBeInTheDocument()
  })

  it('resolves session title at /clients/[uuid]/sessions/[uuid]', () => {
    mockPathname.mockReturnValue(`/clients/${CLIENT_UUID}/sessions/${SESSION_UUID}`)
    render(<BreadcrumbNav />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Kickoff Call')).toBeInTheDocument()
  })

  it('legacy path still resolves session title at /clients/[uuid]/processes/[uuid]/sessions/[uuid]', () => {
    mockPathname.mockReturnValue(
      `/clients/${CLIENT_UUID}/processes/${PROCESS_UUID}/sessions/${SESSION_UUID}`
    )
    render(<BreadcrumbNav />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Purchasing')).toBeInTheDocument()
    expect(screen.getByText('Kickoff Call')).toBeInTheDocument()
  })

  it('client name segment links to client page', () => {
    mockPathname.mockReturnValue(`/clients/${CLIENT_UUID}/processes`)
    render(<BreadcrumbNav />)
    const clientLink = screen.getByText('Acme Corp')
    expect(clientLink.closest('a')).toHaveAttribute('href', `/clients/${CLIENT_UUID}`)
  })

  it('shows process name on process page (last segment is current page)', () => {
    mockPathname.mockReturnValue(`/clients/${CLIENT_UUID}/processes/${PROCESS_UUID}`)
    render(<BreadcrumbNav />)
    expect(screen.getByText('Purchasing')).toBeInTheDocument()
  })
})

describe('BreadcrumbNav shares SWR cache with sidebar and page', () => {
  it('breadcrumb and sidebar must be inside SWRProvider', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const layoutSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/(dashboard)/layout.tsx'),
      'utf-8'
    )

    // SWRProvider must wrap both BreadcrumbNav and the children
    // i.e. SWRProvider should appear BEFORE BreadcrumbNav in the JSX tree
    const swrProviderIdx = layoutSource.indexOf('<SWRProvider')
    const breadcrumbIdx = layoutSource.indexOf('<BreadcrumbNav')
    const sidebarIdx = layoutSource.indexOf('<AppSidebar')

    expect(swrProviderIdx).toBeGreaterThan(-1)
    expect(breadcrumbIdx).toBeGreaterThan(-1)
    expect(sidebarIdx).toBeGreaterThan(-1)

    // SWRProvider must open BEFORE both BreadcrumbNav and AppSidebar
    expect(swrProviderIdx).toBeLessThan(breadcrumbIdx)
    expect(swrProviderIdx).toBeLessThan(sidebarIdx)
  })
})
