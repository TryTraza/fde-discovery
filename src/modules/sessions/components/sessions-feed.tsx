'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Plus, ArrowRight } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getSessionTypeLabel } from '@/lib/utils/session-labels'
import { CreateSessionDialog } from '@/modules/sessions/components/create-session-dialog'
import { SuggestedNextSession } from './suggested-next-session'
import type { ProcessStepParsed } from '@/lib/validations/process'

const STATUS_DOT_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500',
  synthesis_done: 'bg-emerald-500',
  in_progress: 'bg-blue-500',
  planned: 'bg-violet-500',
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Done',
  synthesis_done: 'Done',
  in_progress: 'Active',
  planned: 'Planned',
}

interface SessionsFeedProps {
  clientId: string
  processId: string
  sessions: any[]
  isLoading: boolean
  error: any
  mutateSessions: () => void
  steps: ProcessStepParsed[]
  processStatus: string
}

export function SessionsFeed({
  clientId,
  processId,
  sessions,
  isLoading,
  error,
  mutateSessions,
  steps,
  processStatus,
}: SessionsFeedProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Sessions</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5 mr-1" />
            New
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} data-testid="session-skeleton" className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-muted-foreground">
            Failed to load sessions.{' '}
            <Button
              variant="link"
              size="sm"
              onClick={() => mutateSessions()}
              className="h-auto p-0 underline"
            >
              Retry
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No sessions yet. Create one to start gathering data.
          </p>
        ) : (
          <div className="space-y-1">
            {sessions.map((session: any) => (
              <Link
                key={session.id}
                href={`/clients/${clientId}/processes/${processId}/sessions/${session.id}`}
                className="flex items-center gap-3 py-2 px-2 hover:bg-muted/50 rounded-md transition-colors"
              >
                <span
                  data-testid="session-status-dot"
                  className={`size-2 rounded-full flex-shrink-0 ${STATUS_DOT_COLORS[session.status] ?? 'bg-gray-400'}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{session.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{getSessionTypeLabel(session.type)}</span>
                    {session.date && <span>{session.date}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {STATUS_LABELS[session.status] ?? session.status}
                </span>
              </Link>
            ))}

            <Link
              href={`/clients/${clientId}/processes/${processId}/sessions`}
              className={buttonVariants({ size: 'sm', variant: 'ghost', className: 'w-full mt-1' })}
            >
              View All
              <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </div>
        )}

        {/* Suggested next session */}
        <SuggestedNextSession steps={steps} sessions={sessions} processStatus={processStatus} />
      </div>

      <CreateSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        processId={processId}
        onCreated={() => mutateSessions()}
      />
    </>
  )
}
