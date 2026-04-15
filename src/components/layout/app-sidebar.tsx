'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  Users,
  Settings,
  Compass,
  LifeBuoy,
  ArrowLeft,
  LayoutDashboard,
  FolderKanban,
  FileText,
  Bot,
  Sparkles,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const secondaryNavItems = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: 'https://docs.anthropic.com', label: 'Support', icon: LifeBuoy, external: true },
]

/** Parse the pathname to extract client/process/session context */
function useRouteContext(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  const clientId =
    segments[0] === 'clients' && segments[1] && UUID_RE.test(segments[1]) ? segments[1] : null

  const processId =
    clientId && segments[2] === 'processes' && segments[3] && UUID_RE.test(segments[3])
      ? segments[3]
      : null

  const sessionId =
    processId && segments[4] === 'sessions' && segments[5] && UUID_RE.test(segments[5])
      ? segments[5]
      : null

  return { clientId, processId, sessionId }
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { clientId, processId, sessionId } = useRouteContext(pathname)

  const { data: clientData } = useSWR(clientId ? `/api/clients/${clientId}` : null)
  const { data: processData } = useSWR(
    clientId && processId ? `/api/clients/${clientId}/processes/${processId}` : null
  )
  const { data: sessionData } = useSWR(sessionId ? `/api/sessions/${sessionId}` : null)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/clients" />} tooltip="Discovery Tool">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Compass className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Discovery Tool</span>
                <span className="truncate text-xs text-muted-foreground">FDE workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Main nav — always visible */}
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/clients" />}
                  isActive={pathname === '/clients'}
                  tooltip="Clients"
                >
                  <Users />
                  <span>Clients</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings context */}
        {pathname.startsWith('/settings') && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/settings" />}
                      isActive={pathname === '/settings'}
                      tooltip="General"
                    >
                      <Settings />
                      <span>General</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/settings/ai-agents" />}
                      isActive={pathname === '/settings/ai-agents'}
                      tooltip="AI Agents"
                    >
                      <Bot />
                      <span>AI Agents</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/settings/skills" />}
                      isActive={pathname === '/settings/skills'}
                      tooltip="Skills"
                    >
                      <Sparkles />
                      <span>Skills</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Client context — visible at both client and process levels */}
        {clientId && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="truncate">
                {clientData?.name ?? 'Client'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<Link href="/clients" />} tooltip="All Clients">
                      <ArrowLeft />
                      <span>All Clients</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href={`/clients/${clientId}`} />}
                      isActive={pathname === `/clients/${clientId}`}
                      tooltip="Overview"
                    >
                      <LayoutDashboard />
                      <span>Overview</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href={`/clients/${clientId}/processes`} />}
                      isActive={pathname === `/clients/${clientId}/processes`}
                      tooltip="Processes"
                    >
                      <FolderKanban />
                      <span>Processes</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Process context */}
        {processId && clientId && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="truncate">
                {processData?.name ?? 'Process'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href={`/clients/${clientId}/processes`} />}
                      tooltip="All Processes"
                    >
                      <ArrowLeft />
                      <span>All Processes</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href={`/clients/${clientId}/processes/${processId}`} />}
                      isActive={pathname === `/clients/${clientId}/processes/${processId}`}
                      tooltip="Overview"
                    >
                      <LayoutDashboard />
                      <span>Overview</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link href={`/clients/${clientId}/processes/${processId}/sessions`} />
                      }
                      isActive={pathname === `/clients/${clientId}/processes/${processId}/sessions`}
                      tooltip="Sessions"
                    >
                      <FileText />
                      <span>Sessions</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Session context */}
        {sessionId && processId && clientId && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="truncate">
                {sessionData?.title ?? 'Session'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link href={`/clients/${clientId}/processes/${processId}/sessions`} />
                      }
                      tooltip="All Sessions"
                    >
                      <ArrowLeft />
                      <span>All Sessions</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={`/clients/${clientId}/processes/${processId}/sessions/${sessionId}`}
                        />
                      }
                      isActive={
                        pathname ===
                        `/clients/${clientId}/processes/${processId}/sessions/${sessionId}`
                      }
                      tooltip="Overview"
                    >
                      <LayoutDashboard />
                      <span>Overview</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavItems.map((item) => {
                const isActive = !('external' in item) && pathname.startsWith(item.href)
                const linkProps =
                  'external' in item ? { target: '_blank', rel: 'noopener noreferrer' } : {}
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} {...linkProps} />}
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={user?.fullName ?? 'Account'}>
              <UserButton />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user?.fullName ?? 'User'}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.primaryEmailAddress?.emailAddress ?? ''}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
