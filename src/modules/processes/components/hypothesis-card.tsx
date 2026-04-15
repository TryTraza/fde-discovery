'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { processesService } from '@/modules/processes/services/processes-service'
import { ApiError, ApiKeyMissingError } from '@/lib/api-client'

interface HypothesisCardProps {
  process: any
  clientId: string
  mutateProcess: () => Promise<any>
}

export function HypothesisCard({ process, clientId, mutateProcess }: HypothesisCardProps) {
  const [isPolling, setIsPolling] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [justRegenerated, setJustRegenerated] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingActiveRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    intervalRef.current = null
    timeoutRef.current = null
    pollingActiveRef.current = false
    setIsPolling(false)
    setJustRegenerated(false)
  }, [])

  const startPolling = useCallback(
    (checkFn: (data: any) => boolean) => {
      if (pollingActiveRef.current) return
      pollingActiveRef.current = true
      setIsPolling(true)
      setTimedOut(false)

      intervalRef.current = setInterval(async () => {
        if (!pollingActiveRef.current) return
        try {
          const updated = await mutateProcess()
          if (updated && checkFn(updated)) {
            stopPolling()
          }
        } catch {
          // Swallow — will retry on next interval
        }
      }, 2000)

      timeoutRef.current = setTimeout(() => {
        stopPolling()
        setTimedOut(true)
      }, 30000)
    },
    [mutateProcess, stopPolling]
  )

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling])

  // Auto-poll when hypothesis is null on a fresh draft or after regeneration
  useEffect(() => {
    const shouldAutoPoll =
      (!process.hypothesisText && process.status === 'draft') || justRegenerated

    if (!shouldAutoPoll) return
    startPolling((data) => !!data.hypothesisText)
  }, [process.hypothesisText, process.status, justRegenerated, startPolling])

  const handleRegenerate = useCallback(async () => {
    try {
      await processesService.regenerateHypothesis(clientId, process.id)
    } catch (error) {
      if (error instanceof ApiKeyMissingError) {
        toast.error('Configure your API key in Settings')
        return
      }
      if (error instanceof ApiError) {
        toast.error('Failed to regenerate hypothesis')
        return
      }
      toast.error('Failed to regenerate hypothesis')
      return
    }

    toast.success('Hypothesis generation started')
    setJustRegenerated(true)
    const previousHypothesis = process.hypothesisText
    startPolling((data) => !!data.hypothesisText && data.hypothesisText !== previousHypothesis)
  }, [clientId, process.id, process.hypothesisText, startPolling])

  return (
    <div>
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
        <div>
          <div
            className={cn(
              'text-sm text-muted-foreground leading-relaxed px-4 py-3 bg-muted/30 rounded-lg border-l-[3px] border-muted-foreground/20',
              !showFull && 'line-clamp-3'
            )}
          >
            {process.hypothesisText}
          </div>
          <div className="flex items-center gap-3 mt-2 px-1">
            <button
              onClick={() => setShowFull(!showFull)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFull ? 'Collapse' : 'Show full hypothesis'}
            </button>
            <span className="text-muted-foreground">·</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleRegenerate}
              disabled={isPolling}
            >
              <RefreshCw className="size-3 mr-1" />
              Regenerate
            </Button>
            {process.processTypeL1 && process.processTypeL1 !== 'unknown' && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {process.processTypeL1}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4">
          No hypothesis generated yet. Click Regenerate or configure your API key in Settings.
        </p>
      )}
    </div>
  )
}
