'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolves UUID segments to human-readable names.
 * Returns a map of segment index → resolved name.
 *
 * Supported patterns:
 *   /clients/[clientId]                          → client name
 *   /clients/[clientId]/processes/[processId]    → client name + process name
 */
function useResolvedNames(segments: string[]): Record<number, string> {
  const names: Record<number, string> = {}

  // Resolve client name: segments[0]=clients, segments[1]=uuid
  const clientIdx = segments[0] === 'clients' && segments[1] && UUID_RE.test(segments[1]) ? 1 : -1
  const clientId = clientIdx >= 0 ? segments[clientIdx] : null

  const { data: clientData } = useSWR(clientId ? `/api/clients/${clientId}` : null)
  if (clientIdx >= 0 && clientData?.name) {
    names[clientIdx] = clientData.name
  }

  // Resolve process name: segments[2]=processes, segments[3]=uuid
  const processIdx =
    clientId && segments[2] === 'processes' && segments[3] && UUID_RE.test(segments[3]) ? 3 : -1
  const processId = processIdx >= 0 ? segments[processIdx] : null

  const { data: processData } = useSWR(
    clientId && processId ? `/api/clients/${clientId}/processes/${processId}` : null
  )
  if (processIdx >= 0 && processData?.name) {
    names[processIdx] = processData.name
  }

  // Resolve session name: segments[4]=sessions, segments[5]=uuid
  const sessionIdx =
    processId && segments[4] === 'sessions' && segments[5] && UUID_RE.test(segments[5]) ? 5 : -1
  const sessionId = sessionIdx >= 0 ? segments[sessionIdx] : null

  const { data: sessionData } = useSWR(sessionId ? `/api/sessions/${sessionId}` : null)
  if (sessionIdx >= 0 && sessionData?.title) {
    names[sessionIdx] = sessionData.title
  }

  return names
}

export function BreadcrumbNav() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const resolvedNames = useResolvedNames(segments)

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.flatMap((segment, i) => {
          const isLast = i === segments.length - 1
          const href = '/' + segments.slice(0, i + 1).join('/')
          const isUuid = UUID_RE.test(segment)
          const label =
            resolvedNames[i] ?? (isUuid ? segment.slice(0, 8) + '...' : segment.replace(/-/g, ' '))

          const items: React.ReactNode[] = []
          if (i > 0) {
            items.push(<BreadcrumbSeparator key={`sep-${href}`} />)
          }
          items.push(
            <BreadcrumbItem key={href}>
              {isLast ? (
                <BreadcrumbPage className="capitalize">{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={href} className="capitalize">
                  {label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          )
          return items
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
