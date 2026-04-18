'use client'

import Link from 'next/link'
import { useProcesses } from '@/modules/processes/hooks/use-processes'
import { useClient } from '@/modules/clients/hooks/use-clients'
import { ProcessStatusBadge } from './process-status-badge'
import { CreateProcessDialog } from './create-process-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Plus } from 'lucide-react'

interface ProcessesListProps {
  clientId: string
}

export function ProcessesList({ clientId }: ProcessesListProps) {
  const { processes, isLoading, error, mutateProcesses } = useProcesses(clientId)
  const { client } = useClient(clientId)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/clients/${clientId}`}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-2xl font-bold">Processes</h1>
          {client && <span className="text-muted-foreground text-sm">— {client.name}</span>}
        </div>
        <CreateProcessDialog clientId={clientId} onCreated={() => mutateProcesses()}>
          <Button>
            <Plus className="mr-1.5 size-4" />
            New Process
          </Button>
        </CreateProcessDialog>
      </div>

      {error ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-2">Failed to load processes.</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => mutateProcesses()}
            className="h-auto p-0 underline"
          >
            Retry
          </Button>
        </div>
      ) : processes.length === 0 ? (
        <div className="text-center py-6 border rounded-lg">
          <p className="text-muted-foreground mb-2">
            No processes yet. Create one to start mapping.
          </p>
          <CreateProcessDialog clientId={clientId} onCreated={() => mutateProcesses()}>
            <Button variant="outline">
              <Plus className="mr-1.5 size-4" />
              Create Process
            </Button>
          </CreateProcessDialog>
        </div>
      ) : (
        <div className="grid gap-3">
          {processes.map((process: any) => (
            <Link
              key={process.id}
              href={`/clients/${clientId}/processes/${process.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <span className="font-medium">{process.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {process.departmentTag && <span>{process.departmentTag}</span>}
                  {process.description && (
                    <span className="line-clamp-1 max-w-md">{process.description}</span>
                  )}
                </div>
              </div>
              <ProcessStatusBadge status={process.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
