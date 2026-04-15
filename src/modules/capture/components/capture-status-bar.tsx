'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface CaptureStatusBarProps {
  startTime: number
  isOnline: boolean
  unsyncedCount: number
  eventCount: number
  onEndSession: () => void
}

export function CaptureStatusBar({
  startTime,
  isOnline,
  unsyncedCount,
  eventCount,
  onEndSession,
}: CaptureStatusBarProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startTime), 1000)
    return () => clearInterval(id)
  }, [startTime])

  const minutes = Math.floor(elapsed / 60_000)
  const seconds = Math.floor((elapsed % 60_000) / 1000)
  const timerDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <Card className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-lg font-semibold tabular-nums">{timerDisplay}</span>
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
          />
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {unsyncedCount > 0 && (
          <span className="text-xs text-muted-foreground">{unsyncedCount} pending</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{eventCount} events</span>
        {eventCount > 0 && (
          <Button variant="destructive" size="sm" onClick={onEndSession}>
            Stop Session
          </Button>
        )}
      </div>
    </Card>
  )
}
