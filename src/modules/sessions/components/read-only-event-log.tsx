'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getEventTypeConfig, EVENT_TYPE_CONFIG } from '@/lib/capture/event-types';
import type { EventType } from '@/lib/db/schema';
import { sessionsService } from '@/modules/sessions/services/sessions-service';
import { SESSION_KEYS } from '@/modules/sessions/lib/swr-keys';

interface ServerEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  type: EventType;
  label: string | null;
  detail: string | null;
  suggestionUsed: boolean;
}

interface ReadOnlyEventLogProps {
  sessionId: string;
  footer?: React.ReactNode;
}

export function ReadOnlyEventLog({ sessionId, footer }: ReadOnlyEventLogProps) {
  const { data: events, isLoading } = useSWR<ServerEvent[]>(
    SESSION_KEYS.events(sessionId),
    () => sessionsService.listEvents(sessionId) as Promise<ServerEvent[]>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No events recorded for this session.</p>
        </CardContent>
        {footer && (
          <div className="border-t px-4 py-3">{footer}</div>
        )}
      </Card>
    );
  }

  // Summary stats
  const typeCounts = EVENT_TYPE_CONFIG.map((config) => ({
    ...config,
    count: events.filter((e) => e.type === config.id).length,
  })).filter((t) => t.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Event Log</CardTitle>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{events.length} total</span>
          {typeCounts.map((t) => (
            <span key={t.id} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${t.dotColor}`} />
              {t.count} {t.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto space-y-0">
          {events.map((event) => {
            const config = getEventTypeConfig(event.type);
            const ts = new Date(event.timestamp);
            const timeStr = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}:${String(ts.getSeconds()).padStart(2, '0')}`;

            let displayText = event.label ?? '';
            if (event.type === 'IMPLICIT' && !event.label) displayText = '[unlabeled implicit]';
            if (event.type === 'QUESTION') displayText = event.detail ?? '[question]';
            if (event.type === 'SYSTEM') displayText = event.label ? `${event.label}${event.detail ? ` — ${event.detail}` : ''}` : '';

            return (
              <div key={event.id} className="flex items-center gap-2 py-1.5 px-1 rounded-md text-sm">
                <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                  {timeStr}
                </span>
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${config.dotColor}`} />
                <span className="text-[11px] font-medium text-muted-foreground w-14 flex-shrink-0 truncate">
                  {config.label}
                </span>
                <span className="text-sm">{displayText}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
      {footer && (
        <div className="border-t px-4 py-3">{footer}</div>
      )}
    </Card>
  );
}
