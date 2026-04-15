'use client'

import { useState, useEffect } from 'react'
import { useClients } from '@/modules/clients/hooks/use-clients'
import { ClientCard } from './client-card'
import { ClientFilters } from './client-filters'
import { CreateClientDialog } from './create-client-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiKeyBanner } from '@/components/shared/api-key-banner'
import { Plus } from 'lucide-react'

export function ClientList() {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { clients, isLoading, mutateClients } = useClients({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  return (
    <div className="space-y-6">
      <ApiKeyBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <CreateClientDialog onCreated={mutateClients}>
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            New Client
          </Button>
        </CreateClientDialog>
      </div>
      <ClientFilters
        searchValue={searchInput}
        onSearchChange={setSearchInput}
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
          {debouncedSearch || statusFilter !== 'all'
            ? 'No clients match your filters.'
            : 'No clients yet. Create your first client to get started.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={{
                id: client.id,
                name: client.name,
                industry: client.industry,
                status: client.status,
                hqLocation: client.hqLocation,
                website: client.website,
                createdAt:
                  client.createdAt instanceof Date
                    ? client.createdAt.toISOString()
                    : String(client.createdAt),
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
