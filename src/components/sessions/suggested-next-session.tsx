import type { ProcessStepParsed } from '@/lib/validations/process';
import { Lightbulb } from 'lucide-react';

interface SuggestedNextSessionProps {
  steps: ProcessStepParsed[];
  sessions: any[];
  processStatus: string;
}

interface Suggestion {
  type: string;
  reason: string;
  color: string;
}

function getSuggestion(
  steps: ProcessStepParsed[],
  sessions: any[],
  processStatus: string
): Suggestion | null {
  if (processStatus === 'locked') return null;

  const completedSessions = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'synthesis_done'
  );

  if (completedSessions.length === 0) {
    return {
      type: 'Discovery',
      reason: 'Start by interviewing stakeholders to understand the process.',
      color: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
    };
  }

  const missingSteps = steps.filter((s) => s.confidence === 'missing');
  if (missingSteps.length > 0) {
    const gapName = missingSteps[0].name || 'unknown step';
    return {
      type: 'Shadowing',
      reason: `Observe "${gapName}" to fill gaps in the process map.`,
      color: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200',
    };
  }

  const confirmed = steps.filter((s) => s.confidence === 'confirmed').length;
  const inferred = steps.filter((s) => s.confidence === 'inferred').length;
  if (inferred > confirmed) {
    return {
      type: 'Process Mapping',
      reason: 'Most steps are inferred. Map the process in detail with a subject matter expert.',
      color: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
    };
  }

  if (steps.length > 0 && confirmed >= inferred) {
    return {
      type: 'Validation',
      reason: 'All steps are confirmed. Validate the complete process with stakeholders.',
      color: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200',
    };
  }

  return null;
}

export function SuggestedNextSession({
  steps,
  sessions,
  processStatus,
}: SuggestedNextSessionProps) {
  const suggestion = getSuggestion(steps, sessions, processStatus);
  if (!suggestion) return null;

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${suggestion.color}`}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <Lightbulb className="size-3.5" />
        Suggested: {suggestion.type}
      </div>
      <p className="text-xs mt-1 opacity-80">{suggestion.reason}</p>
    </div>
  );
}
