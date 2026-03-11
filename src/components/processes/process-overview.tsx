'use client';

import Link from 'next/link';
import { useProcess } from '@/lib/hooks/use-processes';
import { ProcessDetailCard } from './process-detail-card';
import { HypothesisCard } from './hypothesis-card';
import { ProcessFlow } from './process-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface ProcessOverviewProps {
  clientId: string;
  processId: string;
}

export function ProcessOverview({ clientId, processId }: ProcessOverviewProps) {
  const { process, isLoading, error, mutateProcess } = useProcess(clientId, processId);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/clients/${clientId}`} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-bold">{process.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <ProcessDetailCard
            process={process}
            clientId={clientId}
            mutateProcess={mutateProcess}
          />
          <HypothesisCard
            process={process}
            clientId={clientId}
            mutateProcess={mutateProcess}
          />
        </div>
        <div className="lg:col-span-2">
          <ProcessFlow
            process={process}
            clientId={clientId}
            processId={processId}
            mutateProcess={mutateProcess}
          />
        </div>
      </div>
    </div>
  );
}
