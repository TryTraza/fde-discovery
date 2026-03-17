'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSessions } from '@/lib/hooks/use-sessions';
import { useProcess } from '@/lib/hooks/use-processes';
import { getSessionTypeLabel } from '@/lib/utils/session-labels';
import { SessionStatusBadge } from './session-status-badge';
import { CreateSessionDialog } from './create-session-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, CalendarDays } from 'lucide-react';

interface SessionsListPageProps {
  clientId: string;
  processId: string;
}

export function SessionsListPage({ clientId, processId }: SessionsListPageProps) {
  const { sessions, isLoading, error, mutateSessions } = useSessions(processId);
  const { process } = useProcess(clientId, processId);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/clients/${clientId}/processes/${processId}`}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-2xl font-bold">Sessions</h1>
          {process && (
            <span className="text-muted-foreground text-sm">— {process.name}</span>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          New Session
        </Button>
      </div>

      {error ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-2">Failed to load sessions.</p>
          <button onClick={() => mutateSessions()} className="text-sm text-primary underline">
            Retry
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">No sessions yet. Create one to start gathering data.</p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            Create Session
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((session: any) => (
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
        onCreated={() => mutateSessions()}
      />
    </div>
  );
}
