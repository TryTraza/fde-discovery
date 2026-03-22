import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventSync } from '@/lib/hooks/use-event-sync';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useEventSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockImplementation((url: string) => {
      // Initial GET to load existing events — return empty array
      if (typeof url === 'string' && url.endsWith('/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      // Default for batch sync POSTs
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ created: 0, events: [] }),
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('addEvent creates a local event with synced=false and serverId=null', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'Opens email');
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].synced).toBe(false);
    expect(result.current.events[0].serverId).toBeNull();
    expect(result.current.events[0].type).toBe('STEP');
    expect(result.current.events[0].label).toBe('Opens email');
  });

  it('addEvent stores detail field when provided', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('SYSTEM', 'SAP', 'Transaction VA01', false);
    });
    expect(result.current.events[0].detail).toBe('Transaction VA01');
  });

  it('unsyncedCount reflects pending events', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'Step 1');
      result.current.addEvent('EDGE', 'Edge 1');
    });
    expect(result.current.unsyncedCount).toBe(2);
  });

  it('flushAll sends batch request and maps server IDs back', async () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'Step 1');
    });
    // Set up mock for the batch POST (after mount GET already resolved)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        created: 1,
        events: [{ id: 'server-uuid-123' }],
      }),
    });
    await act(async () => {
      await result.current.flushAll();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/session-1/events/batch',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.current.unsyncedCount).toBe(0);
    // Server events loaded on mount + the new event with serverId mapped
    const stepEvent = result.current.events.find((e) => e.label === 'Step 1');
    expect(stepEvent?.serverId).toBe('server-uuid-123');
  });

  it('updateEventField updates local event label', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    let event: any;
    act(() => {
      event = result.current.addEvent('IMPLICIT', null);
    });
    act(() => {
      result.current.updateEventField(event.localId, 'label', 'geography mapping');
    });
    expect(result.current.events[0].label).toBe('geography mapping');
  });

  it('updateEventField updates local event detail', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    let event: any;
    act(() => {
      event = result.current.addEvent('QUESTION', null);
    });
    act(() => {
      result.current.updateEventField(event.localId, 'detail', '¿Por qué usan Excel aquí?');
    });
    expect(result.current.events[0].detail).toBe('¿Por qué usan Excel aquí?');
  });

  it('updateEventField PATCHes server when event has serverId', async () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('IMPLICIT', null);
    });
    // Set up mock for the batch POST
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        created: 1,
        events: [{ id: 'server-uuid-456' }],
      }),
    });
    await act(async () => {
      await result.current.flushAll();
    });
    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const implicitEvent = result.current.events.find((e) => e.type === 'IMPLICIT');
    act(() => {
      result.current.updateEventField(implicitEvent!.localId, 'label', 'new label');
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/session-1/events/server-uuid-456',
      expect.objectContaining({ method: 'PATCH' })
    );
    const patchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(patchBody).toEqual({ label: 'new label' });
  });

  it('updateEventField does NOT fire PATCH when event has no serverId', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    let event: any;
    act(() => {
      event = result.current.addEvent('IMPLICIT', null);
    });
    mockFetch.mockClear();
    act(() => {
      result.current.updateEventField(event.localId, 'label', 'test label');
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('addEvent assigns unique localIds', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'A');
      result.current.addEvent('STEP', 'B');
    });
    expect(result.current.events[0].localId).not.toBe(result.current.events[1].localId);
  });

  it('addEvent sets timestamp close to now', () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useEventSync('session-1'));
    const before = Date.now();
    act(() => {
      result.current.addEvent('STEP', 'A');
    });
    const after = Date.now();
    const ts = new Date(result.current.events[0].timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    vi.useFakeTimers();
  });

  it('flushAll is no-op when all events synced', async () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    mockFetch.mockClear(); // Clear the mount GET call
    await act(async () => {
      await result.current.flushAll();
    });
    // No batch POST should be made since there are no unsynced events
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('flushAll throws on sync failure (caller handles error)', async () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'A');
    });
    // Set up failing mock for the batch POST
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    });

    await expect(
      act(async () => {
        await result.current.flushAll();
      })
    ).rejects.toThrow('Batch sync failed during flushAll');

    expect(result.current.unsyncedCount).toBe(1);
    expect(result.current.isSyncing).toBe(false);
  });
});
