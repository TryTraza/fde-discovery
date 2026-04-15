'use client'

import { usePathname } from 'next/navigation'

/**
 * Extracts clientId and processId from the current URL path.
 * Pattern: /clients/[clientId]/processes/[processId]/...
 */
export function useResearchContext() {
  const pathname = usePathname()

  const clientMatch = pathname.match(/\/clients\/([^/]+)/)
  const processMatch = pathname.match(/\/processes\/([^/]+)/)

  return {
    clientId: clientMatch?.[1] ?? undefined,
    processId: processMatch?.[1] ?? undefined,
  }
}
