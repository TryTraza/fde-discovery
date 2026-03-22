'use client';

import type { SuggestionsOutput } from '@/lib/ai/schemas/suggestions';

interface SuggestionChipsProps {
  suggestions: SuggestionsOutput['suggestions'];
  isLoading: boolean;
  onSelectSuggestion: (text: string) => void;
}

export function SuggestionChips({ suggestions, isLoading, onSelectSuggestion }: SuggestionChipsProps) {
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2 border-b overflow-x-auto min-w-0">
      {isLoading && suggestions.length === 0 && (
        <>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-24 rounded-full bg-muted animate-pulse flex-shrink-0"
            />
          ))}
        </>
      )}
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelectSuggestion(s.text)}
          className="
            px-3 py-1.5 rounded-full border text-sm whitespace-nowrap flex-shrink-0
            bg-background hover:bg-primary/10 hover:border-primary/30
            transition-colors min-h-[36px]
          "
        >
          {s.text}
        </button>
      ))}
    </div>
  );
}
