'use client'

import { useRef } from 'react'
import { ProcessesList } from '@/modules/processes/components/processes-list'
import { CreateProcessDialog } from '@/modules/processes/components/create-process-dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function ProcessesContent({ clientId }: { clientId: string }) {
  const mutateRef = useRef<() => void>(() => {})

  return (
    <div className="space-y-6 pt-4 md:pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Processes</h1>
        <CreateProcessDialog clientId={clientId} onCreated={() => mutateRef.current()}>
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            New Process
          </Button>
        </CreateProcessDialog>
      </div>
      <ProcessesList clientId={clientId} mutateRef={mutateRef} />
    </div>
  )
}
