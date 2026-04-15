'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSessions } from '@/lib/hooks/use-sessions';
import { getSessionTypeLabel } from '@/lib/utils/session-labels';
import { SessionStatusBadge } from './session-status-badge';
import { CollapsibleCard } from '@/components/shared/collapsible-card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, CalendarDays, ArrowRight } from 'lucide-react';
import { CreateSessionDialog } from './create-session-dialog';

interface SessionsListProps {
  clientId: string;
  processId: string;
}

export function SessionsList({ clientId, processId }: SessionsListProps) {
  const { sessions, isLoading, error, mutateSessions } = useSessions(processId);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <CollapsibleCard
        title="Sessions"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/clients/${clientId}/processes/${processId}/sessions`}
              className={buttonVariants({ size: 'sm', variant: 'ghost' })}
            >
              View All
              <ArrowRight className="ml-1 size-3.5" />
            </Link>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              New Session
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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
          <p className="text-sm text-muted-foreground">
            No sessions yet. Create one to start gathering data.
          </p>
        ) : (
          <div className="divide-y">
            {sessions.map((session: any) => (
              <Link
                key={session.id}
                href={`/clients/${clientId}/processes/${processId}/sessions/${session.id}`}
                className="flex items-center justify-between py-2.5 px-1 hover:bg-muted/50 rounded-sm transition-colors -mx-1"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {session.title}
                    </span>
                    <SessionStatusBadge status={session.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>{getSessionTypeLabel(session.type)}</span>
                    {session.date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {session.date}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CollapsibleCard>

      <CreateSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        processId={processId}
        onCreated={() => mutateSessions()}
      />
    </>
  );
}
