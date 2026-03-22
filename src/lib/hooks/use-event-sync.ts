'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EventType } from '@/lib/db/schema';

export interface LocalEvent {
  localId: string;
  serverId: string | null;
  sessionId: string;
  timestamp: string;
  type: EventType;
  label: string | null;
  detail: string | null;
  suggestionUsed: boolean;
  synced: boolean;
}

interface UseEventSyncReturn {
  events: LocalEvent[];
  addEvent: (type: EventType, label: string | null, detail?: string | null, suggestionUsed?: boolean) => LocalEvent;
  updateEventField: (localId: string, field: 'label' | 'detail', value: string) => void;
  removeEvent: (localId: string) => void;
  unsyncedCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  flushAll: () => Promise<void>;
}

export function useEventSync(sessionId: string): UseEventSyncReturn {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const eventsRef = useRef<LocalEvent[]>([]);
  const isSyncingRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // Load existing server events on mount (for resumed sessions)
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    fetch(`/api/sessions/${sessionId}/events`)
      .then((res) => res.ok ? res.json() : [])
      .then((serverEvents: Array<{ id: string; sessionId: string; timestamp: string; type: EventType; label: string | null; detail: string | null; suggestionUsed: boolean }>) => {
        if (serverEvents.length > 0) {
          const loaded: LocalEvent[] = serverEvents.map((ev) => ({
            localId: crypto.randomUUID(),
            serverId: ev.id,
            sessionId: ev.sessionId,
            timestamp: ev.timestamp,
            type: ev.type as EventType,
            label: ev.label,
            detail: ev.detail,
            suggestionUsed: ev.suggestionUsed,
            synced: true,
          }));
          setEvents((prev) => {
            // Merge: keep any local unsynced events, prepend server events
            const serverIds = new Set(loaded.map((e) => e.serverId));
            const localOnly = prev.filter((e) => !e.serverId || !serverIds.has(e.serverId));
            return [...loaded, ...localOnly];
          });
        }
      })
      .catch(() => {
        // Silent — not critical, events will just start fresh
      });
  }, [sessionId]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Beforeunload warning when unsynced events exist
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const unsynced = eventsRef.current.filter((ev) => !ev.synced);
      if (unsynced.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const executeBatchSync = useCallback(async (): Promise<boolean> => {
    const currentEvents = eventsRef.current;
    const unsynced = currentEvents.filter((ev) => !ev.synced);
    if (unsynced.length === 0) return true;

    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/events/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: unsynced.map((ev) => ({
              sessionId: ev.sessionId,
              timestamp: ev.timestamp,
              type: ev.type,
              label: ev.label,
              detail: ev.detail,
              suggestionUsed: ev.suggestionUsed,
            })),
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const serverEvents = data.events as Array<{ id: string }>;

        const localIdToServerId = new Map<string, string>();
        unsynced.forEach((ev, idx) => {
          if (serverEvents[idx]) {
            localIdToServerId.set(ev.localId, serverEvents[idx].id);
          }
        });

        setEvents((prev) =>
          prev.map((ev) => {
            const serverId = localIdToServerId.get(ev.localId);
            if (serverId) {
              return { ...ev, synced: true, serverId };
            }
            return ev;
          })
        );
        return true;
      }
      return false;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, [sessionId]);

  const doSync = useCallback(async () => {
    if (isSyncingRef.current) return;

    const unsynced = eventsRef.current.filter((ev) => !ev.synced);
    if (unsynced.length === 0) return;

    setIsSyncing(true);
    isSyncingRef.current = true;
    try {
      await executeBatchSync();
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [executeBatchSync]);

  const startSyncInterval = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      doSync();
    }, 3000);
  }, [doSync]);

  const stopSyncInterval = useCallback(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  // Timer-based sync: every 3s
  useEffect(() => {
    startSyncInterval();
    return () => stopSyncInterval();
  }, [startSyncInterval, stopSyncInterval]);

  // Threshold-based sync: flush immediately when ≥5 pending
  const lastThresholdSyncCountRef = useRef(0);
  useEffect(() => {
    const unsyncedCount = events.filter((ev) => !ev.synced).length;
    if (unsyncedCount >= 5 && unsyncedCount > lastThresholdSyncCountRef.current) {
      lastThresholdSyncCountRef.current = unsyncedCount;
      doSync();
    }
    if (unsyncedCount === 0) {
      lastThresholdSyncCountRef.current = 0;
    }
  }, [events, doSync]);

  const addEvent = useCallback(
    (
      type: EventType,
      label: string | null,
      detail: string | null = null,
      suggestionUsed = false
    ): LocalEvent => {
      const event: LocalEvent = {
        localId: crypto.randomUUID(),
        serverId: null,
        sessionId,
        timestamp: new Date().toISOString(),
        type,
        label,
        detail,
        suggestionUsed,
        synced: false,
      };
      setEvents((prev) => [...prev, event]);
      return event;
    },
    [sessionId]
  );

  const updateEventField = useCallback((localId: string, field: 'label' | 'detail', value: string) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.localId === localId ? { ...ev, [field]: value } : ev
      )
    );

    const event = eventsRef.current.find((ev) => ev.localId === localId);
    if (event?.serverId) {
      fetch(`/api/sessions/${sessionId}/events/${event.serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      }).catch(() => {
        // Silently fail — field update is not critical
      });
    }
  }, [sessionId]);

  const removeEvent = useCallback((localId: string) => {
    const event = eventsRef.current.find((ev) => ev.localId === localId);
    setEvents((prev) => prev.filter((ev) => ev.localId !== localId));

    // If synced to server, delete server-side too
    if (event?.serverId) {
      fetch(`/api/sessions/${sessionId}/events/${event.serverId}`, {
        method: 'DELETE',
      }).catch(() => {
        // Silent — deletion is best-effort
      });
    }
  }, [sessionId]);

  const flushAll = useCallback(async () => {
    const unsynced = eventsRef.current.filter((ev) => !ev.synced);
    if (unsynced.length === 0) return;

    stopSyncInterval();

    setIsSyncing(true);
    isSyncingRef.current = true;

    try {
      const success = await executeBatchSync();
      if (!success) {
        throw new Error('Batch sync failed during flushAll');
      }
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      startSyncInterval();
    }
  }, [executeBatchSync, stopSyncInterval, startSyncInterval]);

  return {
    events,
    addEvent,
    updateEventField,
    removeEvent,
    unsyncedCount: events.filter((ev) => !ev.synced).length,
    isOnline,
    isSyncing,
    flushAll,
  };
}
