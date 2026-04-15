'use client'

import { EVENT_TYPE_CONFIG } from '@/lib/capture/event-types'
import type { LocalEvent } from '@/lib/hooks/use-event-sync'

interface AnalyticsSidebarProps {
  events: LocalEvent[]
}

export function AnalyticsSidebar({ events }: AnalyticsSidebarProps) {
  const totalEvents = events.length

  const typeCounts = EVENT_TYPE_CONFIG.map((config) => ({
    ...config,
    count: events.filter((e) => e.type === config.id).length,
  })).filter((t) => t.count > 0)

  return (
    <div className="w-full space-y-4">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
        <p className="text-2xl font-semibold tabular-nums">{totalEvents}</p>
      </div>

      {typeCounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">By type</p>
          {typeCounts.map((t) => (
            <div key={t.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{t.label}</span>
                <span className="tabular-nums">{t.count}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${t.dotColor}`}
                  style={{ width: `${(t.count / totalEvents) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
