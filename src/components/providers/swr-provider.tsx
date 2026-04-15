'use client'

import { SWRConfig } from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('Failed to fetch')
    ;(error as any).status = res.status
    try {
      ;(error as any).info = await res.json()
    } catch {
      // Response wasn't JSON — ignore
    }
    throw error
  }
  return res.json()
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  )
}
