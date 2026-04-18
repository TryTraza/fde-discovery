'use client'

import { useRef } from 'react'
import { ClientList } from '@/modules/clients/components/client-list'
import { CreateClientDialog } from '@/modules/clients/components/create-client-dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function ClientsPage() {
  const mutateRef = useRef<() => void>(() => {})

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <CreateClientDialog onCreated={() => mutateRef.current()}>
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            New Client
          </Button>
        </CreateClientDialog>
      </div>
      <ClientList mutateRef={mutateRef} />
    </div>
  )
}
