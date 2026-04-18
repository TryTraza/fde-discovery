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
import { Skeleton } from '@/components/ui/skeleton'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ResolvedNames {
  names: Record<number, string>
  loading: Set<number>
}

function useResolvedNames(segments: string[]): ResolvedNames {
  const names: Record<number, string> = {}
  const loading = new Set<number>()

  const clientIdx = segments[0] === 'clients' && segments[1] && UUID_RE.test(segments[1]) ? 1 : -1
  const clientId = clientIdx >= 0 ? segments[clientIdx] : null

  const { data: clientData, isLoading: clientLoading } = useSWR(
    clientId ? `/api/clients/${clientId}` : null
  )
  if (clientIdx >= 0) {
    if (clientData?.name) names[clientIdx] = clientData.name
    else if (clientLoading) loading.add(clientIdx)
  }

  const processIdx =
    clientId && segments[2] === 'processes' && segments[3] && UUID_RE.test(segments[3]) ? 3 : -1
  const processId = processIdx >= 0 ? segments[processIdx] : null

  const { data: processData, isLoading: processLoading } = useSWR(
    clientId && processId ? `/api/clients/${clientId}/processes/${processId}` : null
  )
  if (processIdx >= 0) {
    if (processData?.name) names[processIdx] = processData.name
    else if (processLoading) loading.add(processIdx)
  }

  const sessionIdx =
    processId && segments[4] === 'sessions' && segments[5] && UUID_RE.test(segments[5]) ? 5 : -1
  const sessionId = sessionIdx >= 0 ? segments[sessionIdx] : null

  const { data: sessionData, isLoading: sessionLoading } = useSWR(
    sessionId ? `/api/sessions/${sessionId}` : null
  )
  if (sessionIdx >= 0) {
    if (sessionData?.title) names[sessionIdx] = sessionData.title
    else if (sessionLoading) loading.add(sessionIdx)
  }

  return { names, loading }
}

export function BreadcrumbNav() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const { names, loading } = useResolvedNames(segments)

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
          const isLoading = isUuid && loading.has(i)
          const label = names[i] ?? (isUuid ? null : segment.replace(/-/g, ' '))

          const items: React.ReactNode[] = []
          if (i > 0) {
            items.push(<BreadcrumbSeparator key={`sep-${href}`} />)
          }
          items.push(
            <BreadcrumbItem key={href}>
              {isLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : isLast ? (
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
