'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { SuggestionsOutput } from '@/lib/ai/schemas/suggestions'

interface UseSuggestionsReturn {
  suggestions: SuggestionsOutput['suggestions']
  isLoading: boolean
  fetchSuggestions: (sessionId: string, activeType: 'STEP' | 'EDGE', eventCount: number) => void
  clearSuggestions: () => void
}

const SUGGESTIONS_DEBOUNCE_MS = 200
const SUGGESTIONS_TIMEOUT_MS = 1500

/**
 * Suggestions don't go through the central apiClient — they need fine-grained
 * control over abort + debounce + UI-timeout windows so the capture page never
 * blocks on a slow Haiku call. The endpoint also intentionally returns
 * `{ suggestions: [] }` on every error path (NO_API_KEY, 5xx, network), so we
 * must NOT throw or surface errors here.
 */
export function useSuggestions(): UseSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<SuggestionsOutput['suggestions']>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (abortRef.current) abortRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const fetchSuggestions = useCallback(
    (sessionId: string, activeType: 'STEP' | 'EDGE', eventCount: number) => {
      if (abortRef.current) abortRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)

      setIsLoading(true)
      setSuggestions([])

      debounceRef.current = setTimeout(() => {
        const controller = new AbortController()
        abortRef.current = controller

        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) setIsLoading(false)
        }, SUGGESTIONS_TIMEOUT_MS)

        fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, activeType, eventCount }),
          signal: controller.signal,
        })
          .then((res) => res.json())
          .then((data) => {
            if (!controller.signal.aborted && mountedRef.current) {
              setSuggestions(data.suggestions ?? [])
              setIsLoading(false)
              if (timeoutRef.current) clearTimeout(timeoutRef.current)
            }
          })
          .catch(() => {
            if (!controller.signal.aborted && mountedRef.current) {
              setSuggestions([])
              setIsLoading(false)
              if (timeoutRef.current) clearTimeout(timeoutRef.current)
            }
          })
      }, SUGGESTIONS_DEBOUNCE_MS)
    },
    []
  )

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setIsLoading(false)
    if (abortRef.current) abortRef.current.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  return { suggestions, isLoading, fetchSuggestions, clearSuggestions }
}
