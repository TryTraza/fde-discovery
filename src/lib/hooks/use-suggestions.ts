'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SuggestionsOutput } from '@/lib/ai/schemas/suggestions';

interface UseSuggestionsReturn {
  suggestions: SuggestionsOutput['suggestions'];
  isLoading: boolean;
  fetchSuggestions: (
    sessionId: string,
    activeType: 'STEP' | 'EDGE',
    eventCount: number
  ) => void;
  clearSuggestions: () => void;
}

export function useSuggestions(): UseSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<SuggestionsOutput['suggestions']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSuggestions = useCallback(
    (sessionId: string, activeType: 'STEP' | 'EDGE', eventCount: number) => {
      if (abortRef.current) abortRef.current.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      setIsLoading(true);
      setSuggestions([]);

      debounceRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortRef.current = controller;

        // 1.5s timeout: if slow, stop loading and let user type
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) setIsLoading(false);
        }, 1500);

        fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, activeType, eventCount }),
          signal: controller.signal,
        })
          .then((res) => res.json())
          .then((data) => {
            if (!controller.signal.aborted && mountedRef.current) {
              setSuggestions(data.suggestions ?? []);
              setIsLoading(false);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }
          })
          .catch(() => {
            if (!controller.signal.aborted && mountedRef.current) {
              setSuggestions([]);
              setIsLoading(false);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }
          });
      }, 200);
    },
    []
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setIsLoading(false);
    if (abortRef.current) abortRef.current.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { suggestions, isLoading, fetchSuggestions, clearSuggestions };
}
