'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { CollapsibleCard } from '@/components/shared/collapsible-card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';

interface HypothesisCardProps {
  process: any;
  clientId: string;
  mutateProcess: () => Promise<any>;
}

export function HypothesisCard({ process, clientId, mutateProcess }: HypothesisCardProps) {
  const [isPolling, setIsPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [justRegenerated, setJustRegenerated] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingActiveRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    pollingActiveRef.current = false;
    setIsPolling(false);
    setJustRegenerated(false);
  }, []);

  const startPolling = useCallback((checkFn: (data: any) => boolean) => {
    if (pollingActiveRef.current) return;
    pollingActiveRef.current = true;
    setIsPolling(true);
    setTimedOut(false);

    intervalRef.current = setInterval(async () => {
      if (!pollingActiveRef.current) return;
      try {
        const updated = await mutateProcess();
        if (updated && checkFn(updated)) {
          stopPolling();
        }
      } catch {
        // Swallow — will retry on next interval
      }
    }, 2000);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setTimedOut(true);
    }, 30000);
  }, [mutateProcess, stopPolling]);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Auto-poll when hypothesis is null on a fresh draft or after regeneration
  useEffect(() => {
    const shouldAutoPoll =
      (!process.hypothesisText && process.status === 'draft') ||
      justRegenerated;

    if (!shouldAutoPoll) return;
    startPolling((data) => !!data.hypothesisText);
  }, [process.hypothesisText, process.status, justRegenerated, startPolling]);

  const handleRegenerate = useCallback(async () => {
    const res = await fetch(
      `/api/clients/${clientId}/processes/${process.id}/hypothesis`,
      { method: 'POST' }
    );

    if (res.status === 422) {
      toast.error('Configure your API key in Settings');
      return;
    }

    if (!res.ok) {
      toast.error('Failed to regenerate hypothesis');
      return;
    }

    toast.success('Hypothesis generation started');
    setJustRegenerated(true);
    const previousHypothesis = process.hypothesisText;
    startPolling((data) =>
      !!data.hypothesisText && data.hypothesisText !== previousHypothesis
    );
  }, [clientId, process.id, process.hypothesisText, startPolling]);

  return (
    <CollapsibleCard
      title="Hypothesis"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={isPolling}
        >
          <RefreshCw className="mr-1 size-3.5" />
          Regenerate
        </Button>
      }
    >
      {isPolling ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-4 animate-spin" />
          Generating hypothesis...
        </div>
      ) : timedOut ? (
        <p className="text-sm text-muted-foreground py-4">
          Generation is taking longer than expected. Try regenerating.
        </p>
      ) : process.hypothesisText ? (
        <div className="space-y-3">
          <p className="text-sm">{process.hypothesisText}</p>
          {process.processTypeL1 && process.processTypeL1 !== 'unknown' && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {process.processTypeL1}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4">
          No hypothesis generated yet. Click Regenerate or configure your API key in Settings.
        </p>
      )}
    </CollapsibleCard>
  );
}
