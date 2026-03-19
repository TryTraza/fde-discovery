'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sparkles,
  RefreshCw,
  MessageSquare,
  Lightbulb,
  Target,
  AlertTriangle,
  ChevronDown,
  Check,
  Crosshair,
} from 'lucide-react';
import { getSessionTypeLabel } from '@/lib/utils/session-labels';
import type { PrepBrief } from '@/lib/ai/schemas/prep-brief';

interface PrepBriefPanelProps {
  sessionId: string;
  prepBrief: PrepBrief | null;
  mutateSession: () => void;
  interviewAnswers?: { question: string; answer: string }[];
  questionsAsked: boolean[];
  onToggleQuestion: (index: number) => void;
  sessionType: string;
}

export function PrepBriefPanel({
  sessionId,
  prepBrief,
  mutateSession,
  interviewAnswers,
  questionsAsked,
  onToggleQuestion,
  sessionType,
}: PrepBriefPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [areasExpanded, setAreasExpanded] = useState(false);
  const [expandedApproach, setExpandedApproach] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/prep-brief`, {
        method: 'POST',
      });

      if (res.status === 422) {
        toast.error('Set your Anthropic API key in Settings to use AI features.');
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to generate prep brief');
        return;
      }

      mutateSession();
      toast.success('Prep brief generated');
    } catch {
      toast.error('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  // Empty state
  if (!prepBrief) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        {isLoading ? (
          <>
            <RefreshCw className="size-8 text-muted-foreground animate-spin" />
            <div>
              <p className="font-medium">Generating your prep brief...</p>
              <p className="text-sm text-muted-foreground mt-1">
                This takes a few seconds as AI analyzes the process context.
              </p>
            </div>
          </>
        ) : (
          <>
            <Sparkles className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No prep brief yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate a tailored brief with questions, approaches, and focus areas.
              </p>
            </div>
            <Button variant="outline" onClick={handleGenerate}>
              <Sparkles className="mr-1.5 size-3.5" />
              Generate Prep Brief
            </Button>
          </>
        )}
      </div>
    );
  }

  const totalQuestions = prepBrief.questionsToAsk.length;
  const coveredCount = questionsAsked.filter(Boolean).length;
  const visibleAreas = areasExpanded
    ? prepBrief.areasToProbe
    : prepBrief.areasToProbe.slice(0, 4);
  const hasContext = interviewAnswers && interviewAnswers.length > 0;

  return (
    <div className="space-y-4 min-w-0">
      {/* Context Strip */}
      {hasContext && (
        <div className="rounded-lg border bg-muted/30 px-4 py-2.5 min-w-0">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Crosshair className="size-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium shrink-0">{getSessionTypeLabel(sessionType)}</span>
            <span className="text-muted-foreground truncate min-w-0">
              — {interviewAnswers[0].answer}
            </span>
            <button
              onClick={() => setContextExpanded(!contextExpanded)}
              className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              {contextExpanded ? 'Hide context' : 'Show context'}
            </button>
          </div>
          {contextExpanded && (
            <div className="mt-3 space-y-3 border-t pt-3">
              {interviewAnswers.map((qa, i) => (
                <div key={i}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {qa.question}
                  </p>
                  <p className="text-sm leading-relaxed mt-0.5">{qa.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {coveredCount} of {totalQuestions} questions covered
          </span>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {prepBrief.questionsToAsk.map((_, i) => (
              <div
                key={i}
                className={`size-2.5 rounded-full transition-colors ${
                  questionsAsked[i]
                    ? 'bg-blue-500 dark:bg-blue-400'
                    : 'bg-blue-200 dark:bg-blue-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main grid: LEFT (summary + questions) / RIGHT (strategy + areas + watch) */}
      <div className="grid grid-cols-1 lg:grid-cols-[5fr_3fr] gap-6 items-start min-w-0">
        {/* LEFT COLUMN */}
        <div className="space-y-4 min-w-0">
          {/* Summary + Regenerate */}
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{prepBrief.summary}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleGenerate}
              disabled={isLoading}
              className="shrink-0"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Questions Checklist Card */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="size-4 text-violet-500" />
              <span className="text-sm font-medium">Questions to Ask</span>
            </div>
            <div className="divide-y">
              {prepBrief.questionsToAsk.map((q, i) => {
                const isChecked = questionsAsked[i];
                return (
                  <Collapsible key={i}>
                    <div className={`flex items-start gap-3 py-2.5 ${i === 0 ? 'pt-0' : ''}`}>
                      <button
                        onClick={() => onToggleQuestion(i)}
                        aria-label="Toggle question"
                        className={`mt-0.5 shrink-0 size-5 rounded-full border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-emerald-100 dark:bg-emerald-900 border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400'
                            : 'border-muted-foreground/30 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950'
                        }`}
                      >
                        {isChecked && <Check className="size-3" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1 min-w-0">
                          <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0">
                            {i + 1}.
                          </span>
                          <span
                            className={`text-sm font-medium leading-snug break-words min-w-0 ${
                              isChecked ? 'line-through text-muted-foreground' : ''
                            }`}
                          >
                            {q.question}
                          </span>
                          <CollapsibleTrigger className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronDown className="size-3.5" />
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <div className="mt-1.5 pl-4 space-y-1">
                            <p className="text-xs text-muted-foreground">{q.rationale}</p>
                            <p className="text-xs text-muted-foreground/70 italic">
                              If vague: &ldquo;{q.followUp}&rdquo;
                            </p>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4 min-w-0 overflow-hidden">
          {/* Strategy Card — Approach Pills */}
          <div className="rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="size-4 text-teal-500" />
              <span className="text-sm font-medium">Strategy</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {prepBrief.approaches.map((a, i) => (
                <button
                  key={i}
                  onClick={() =>
                    setExpandedApproach(expandedApproach === i ? null : i)
                  }
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                    expandedApproach === i
                      ? 'bg-teal-200 dark:bg-teal-800 border-teal-400 dark:border-teal-600'
                      : 'bg-teal-100 dark:bg-teal-900 border-teal-200 dark:border-teal-800 hover:bg-teal-200 dark:hover:bg-teal-800'
                  }`}
                >
                  {a.title}
                </button>
              ))}
            </div>
            {expandedApproach !== null && prepBrief.approaches[expandedApproach] && (
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                {prepBrief.approaches[expandedApproach].description}
              </p>
            )}
          </div>

          {/* Areas to Probe Card */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="size-4 text-blue-500" />
              <span className="text-sm font-medium">Areas to Probe</span>
            </div>
            <ul className="space-y-1.5">
              {visibleAreas.map((area, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="size-1.5 rounded-full bg-blue-400 dark:bg-blue-500 mt-1.5 shrink-0" />
                  <span className="break-words">{area}</span>
                </li>
              ))}
            </ul>
            {prepBrief.areasToProbe.length > 4 && (
              <button
                onClick={() => setAreasExpanded(!areasExpanded)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer mt-2"
              >
                {areasExpanded
                  ? 'Show less'
                  : `Show ${prepBrief.areasToProbe.length - 4} more`}
              </button>
            )}
          </div>

          {/* Watch For Card — amber accent, always visible */}
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Watch For
              </span>
            </div>
            <div className="space-y-2">
              {prepBrief.watchFor.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-amber-900 dark:text-amber-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
