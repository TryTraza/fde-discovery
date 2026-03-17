'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { useProcess } from '@/lib/hooks/use-processes';
import { useSessions } from '@/lib/hooks/use-sessions';
import { parseProcessSteps } from '@/lib/validations/process';
import { HypothesisCard } from './hypothesis-card';
import { ProcessFlow } from './process-flow';
import { ProcessStatusBadge } from './process-status-badge';
import { MetadataStrip } from './metadata-strip';
import { EditDetailsSheet } from './edit-details-sheet';
import { SessionsFeed } from '@/components/sessions/sessions-feed';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Trash2 } from 'lucide-react';

interface ProcessOverviewProps {
  clientId: string;
  processId: string;
}

export function ProcessOverview({ clientId, processId }: ProcessOverviewProps) {
  const { process, isLoading, error, mutateProcess } = useProcess(clientId, processId);
  const { sessions, isLoading: sessionsLoading, error: sessionsError, mutateSessions } = useSessions(processId);
  const { user } = useUser();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isAdmin = (user?.publicMetadata as any)?.role === 'admin';

  const onDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/processes/${processId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete process');
        return;
      }
      toast.success('Process deleted');
      router.push(`/clients/${clientId}/processes`);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[150px]" />
      </div>
    );
  }

  if (error || !process) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          {error?.status === 404 ? 'Process not found.' : 'Failed to load process.'}
        </p>
        <Link href={`/clients/${clientId}`} className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back to client
        </Link>
      </div>
    );
  }

  const completedCount = sessions.filter(
    (s: any) => s.status === 'completed' || s.status === 'synthesis_done'
  ).length;

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Header: back + title + status badge + delete */}
      <div className="flex items-center gap-3">
        <Link href={`/clients/${clientId}`} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-bold truncate">{process.name}</h1>
        <ProcessStatusBadge status={process.status} />
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {/* Metadata Strip */}
      <MetadataStrip
        process={process}
        sessionCount={sessions.length}
        completedSessionCount={completedCount}
        onEditClick={() => setSheetOpen(true)}
      />

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,2fr)] gap-6 items-start">
        <div className="min-w-0 space-y-4">
          <HypothesisCard process={process} clientId={clientId} mutateProcess={mutateProcess} />
          <ProcessFlow process={process} clientId={clientId} processId={processId} mutateProcess={mutateProcess} />
        </div>
        <div className="min-w-0 space-y-4">
          <SessionsFeed
            clientId={clientId}
            processId={processId}
            sessions={sessions}
            isLoading={sessionsLoading}
            error={sessionsError}
            mutateSessions={mutateSessions}
            steps={parseProcessSteps(process.processModel?.steps)}
            processStatus={process.status}
          />
        </div>
      </div>

      {/* Edit Details Sheet */}
      <EditDetailsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        process={process}
        clientId={clientId}
        mutateProcess={mutateProcess}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete process?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{process.name}</strong> and all its sessions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
