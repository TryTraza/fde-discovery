import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSuggestions } from '@/lib/hooks/use-suggestions';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty suggestions and isLoading false', () => {
    const { result } = renderHook(() => useSuggestions());
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isLoading true immediately on fetchSuggestions', () => {
    const { result } = renderHook(() => useSuggestions());
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns suggestions after successful fetch (after debounce)', async () => {
    const mockSuggestions = [
      { text: 'Opens email client', rationale: 'Common first step' },
      { text: 'Checks inbox', rationale: 'Follow-up to opening email' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: mockSuggestions }),
    });
    const { result } = renderHook(() => useSuggestions());
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    // Advance past 200ms debounce
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    // Wait for fetch promise to resolve
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.suggestions).toEqual(mockSuggestions);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns empty array on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useSuggestions());
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('clearSuggestions resets state', () => {
    const { result } = renderHook(() => useSuggestions());
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    act(() => {
      result.current.clearSuggestions();
    });
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('debounce prevents fetch within 200ms window', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ suggestions: [] }),
    });
    const { result } = renderHook(() => useSuggestions());

    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.fetchSuggestions('session-1', 'EDGE', 4);
    });
    expect(mockFetch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      activeType: 'EDGE',
    });
  });
});
