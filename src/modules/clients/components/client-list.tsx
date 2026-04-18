'use client'

import { useState, useDeferredValue } from 'react'
import { useClients } from '@/modules/clients/hooks/use-clients'
import { ClientCard } from './client-card'
import { ClientFilters } from './client-filters'
import { Skeleton } from '@/components/ui/skeleton'

interface ClientListProps {
  onMutate?: (mutate: () => void) => void
  mutateRef?: React.MutableRefObject<() => void>
}

export function ClientList({ mutateRef }: ClientListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const deferredSearch = useDeferredValue(search)

  const { clients, isLoading, mutateClients } = useClients({
    search: deferredSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  if (mutateRef) mutateRef.current = mutateClients

  return (
    <div className="space-y-4">
      <ClientFilters
        searchValue={search}
        onSearchChange={setSearch}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-lg" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {deferredSearch || statusFilter !== 'all'
            ? 'No clients match your filters.'
            : 'No clients yet. Create your first client to get started.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  )
}
