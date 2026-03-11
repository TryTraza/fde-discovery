'use client';

import { useState } from 'react';
import { CollapsibleCard } from '@/components/shared/collapsible-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Sparkles } from 'lucide-react';

interface AISummaryCardProps {
  client: any;
  clientId: string;
  mutateClient: () => void;
}

export function AISummaryCard({ client, clientId, mutateClient }: AISummaryCardProps) {
  const [researching, setResearching] = useState(false);

  const onResearchMore = async () => {
    setResearching(true);
    try {
      await fetch(`/api/clients/${clientId}/research`, { method: 'POST' });
      setTimeout(() => {
        mutateClient();
        setResearching(false);
      }, 5000);
    } catch {
      setResearching(false);
    }
  };

  const summary = client.aiSummary;
  const isNoKey = summary && summary.includes('Settings');

  return (
    <CollapsibleCard
      title={
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-4" />
          AI Research
        </span>
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={onResearchMore}
          disabled={researching}
        >
          <RefreshCw className={`mr-1 size-3.5 ${researching ? 'animate-spin' : ''}`} />
          {researching ? 'Researching...' : 'Research more'}
        </Button>
      }
    >
      {researching && !summary ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : !summary ? (
        <p className="text-sm text-muted-foreground">
          No research yet. Click &quot;Research more&quot; to start.
        </p>
      ) : isNoKey ? (
        <p className="text-sm text-muted-foreground">{summary}</p>
      ) : (
        <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap">
          {summary}
        </div>
      )}
    </CollapsibleCard>
  );
}
