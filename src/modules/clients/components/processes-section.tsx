'use client'

import Link from 'next/link'
import { useProcesses } from '@/modules/processes/hooks/use-processes'
import { ProcessStatusBadge } from '@/modules/processes/components/process-status-badge'
import { CreateProcessDialog } from '@/modules/processes/components/create-process-dialog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ArrowRight } from 'lucide-react'

interface ProcessesSectionProps {
  clientId: string
}

const MAX_SHOWN = 3

interface ProcessSummary {
  id: string
  name: string
  departmentTag?: string | null
  status: string
}

export function ProcessesSection({ clientId }: ProcessesSectionProps) {
  const { processes, isLoading, error, mutateProcesses } = useProcesses(clientId)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Processes
            {!isLoading && processes.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal ml-2">
                ({processes.length})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <CreateProcessDialog clientId={clientId} onCreated={() => mutateProcesses()}>
              <Button variant="outline" size="sm">
                <Plus className="mr-1 size-3.5" />
                Add
              </Button>
            </CreateProcessDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">Failed to load processes.</p>
            <Button variant="link" size="sm" onClick={() => mutateProcesses()}>
              Retry
            </Button>
          </div>
        ) : processes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No processes yet. Create one to start mapping.
          </p>
        ) : (
          <div className="space-y-4">
            {(processes as ProcessSummary[]).slice(0, MAX_SHOWN).map((process) => (
              <Link
                key={process.id}
                href={`/clients/${clientId}/processes/${process.id}`}
                className="flex items-center justify-between rounded-md border p-4 text-sm hover:bg-muted/50 transition-colors"
              >
                <div>
                  <span className="font-medium">{process.name}</span>
                  {process.departmentTag && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {process.departmentTag}
                    </span>
                  )}
                </div>
                <ProcessStatusBadge status={process.status} />
              </Link>
            ))}
            <Link
              href={`/clients/${clientId}/processes`}
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'w-full mt-1',
              })}
            >
              View all processes
              <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
