'use client';

import { MessageSquare, Check, TriangleAlert } from 'lucide-react';
import type { PrepQuestion } from '@/lib/ai/schemas/prep-brief';

interface QuestionSidebarProps {
  questions: PrepQuestion[];
  questionsAsked: boolean[];
  onToggleQuestion: (index: number) => void;
  watchFor: string[];
}

export function QuestionSidebar({
  questions,
  questionsAsked,
  onToggleQuestion,
  watchFor,
}: QuestionSidebarProps) {
  const total = questions.length;
  const coveredCount = questionsAsked.filter(Boolean).length;
  const uncoveredCount = total - coveredCount;
  const allCovered = uncoveredCount === 0;

  return (
    <div className="sticky top-4 space-y-4">
      {/* Card 1: Still to cover */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="size-4 text-violet-500" />
          <span className="text-sm font-medium">Still to cover</span>
          {!allCovered && (
            <span className="ml-auto text-xs text-muted-foreground">
              {uncoveredCount} of {total} remaining
            </span>
          )}
        </div>

        {allCovered ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="size-4" />
            <span>All questions covered</span>
          </div>
        ) : (
          <div className="space-y-2">
            {questions.map((q, i) => {
              if (questionsAsked[i]) return null;
              return (
                <div key={i} className="flex items-start gap-2">
                  <button
                    onClick={() => onToggleQuestion(i)}
                    className="mt-0.5 shrink-0 size-5 rounded-full border border-muted-foreground/30 flex items-center justify-center hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors"
                  >
                    <span className="sr-only">Mark as covered</span>
                  </button>
                  <span className="text-sm">
                    <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                    {q.question}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card 2: Active alerts */}
      {watchFor.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Active alerts
            </span>
          </div>
          <div className="space-y-2">
            {watchFor.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="text-amber-900 dark:text-amber-200">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
