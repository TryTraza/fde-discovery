'use client'

import { useState, useDeferredValue } from 'react'
import { useClients } from '@/modules/clients/hooks/use-clients'
import { ClientCard } from './client-card'
import { ClientFilters } from './client-filters'
import { CreateClientDialog } from './create-client-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus } from 'lucide-react'

export function ClientList() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const deferredSearch = useDeferredValue(search)

  const { clients, isLoading, mutateClients } = useClients({
    search: deferredSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CreateClientDialog onCreated={mutateClients}>
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            New Client
          </Button>
        </CreateClientDialog>
      </div>
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
