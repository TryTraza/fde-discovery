'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSessions } from '@/modules/sessions/hooks/use-sessions'
import { type SessionRecord } from '@/modules/sessions/services/sessions-service'
import { getSessionTypeLabel } from '@/lib/utils/session-labels'
import { SessionStatusBadge } from './session-status-badge'
import { CreateSessionDialog } from './create-session-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, CalendarDays } from 'lucide-react'

interface SessionsListPageProps {
  clientId: string
  processId: string
}

export function SessionsListPage({ clientId, processId }: SessionsListPageProps) {
  const { sessions, isLoading, error, mutateSessions } = useSessions(processId)
  const [dialogOpen, setDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          New Session
        </Button>
      </div>

      {error ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-2">Failed to load sessions.</p>
          <Button variant="link" size="sm" onClick={() => mutateSessions()} className="h-auto p-0 underline">
            Retry
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-6 border rounded-lg">
          <p className="text-muted-foreground mb-2">
            No sessions yet. Create one to start gathering data.
          </p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            Create Session
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((session: SessionRecord) => (
            <Link
              key={session.id}
              href={`/clients/${clientId}/processes/${processId}/sessions/${session.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <span className="font-medium">{session.title}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{getSessionTypeLabel(session.type)}</span>
                  {session.date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {session.date}
                    </span>
                  )}
                </div>
              </div>
              <SessionStatusBadge status={session.status} />
            </Link>
          ))}
        </div>
      )}

      <CreateSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        processId={processId}
        onCreated={mutateSessions}
      />
    </div>
  )
}
