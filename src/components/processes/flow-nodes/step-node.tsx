import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { ProcessStepParsed } from '@/lib/validations/process';

const confidenceBarColors = {
  confirmed: 'bg-emerald-500',
  inferred: 'bg-amber-400',
  missing: 'bg-red-400',
};

const confidenceBadgeColors = {
  confirmed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  inferred: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  missing: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

interface StepNodeData {
  step: ProcessStepParsed;
  index: number;
  [key: string]: unknown;
}

function StepNodeComponent({ data, selected }: NodeProps) {
  const { step, index } = data as StepNodeData;
  const isMissing = step.confidence === 'missing';
  const systemsToShow = step.systems.slice(0, 3);
  const extraCount = step.systems.length - 3;

  return (
    <div
      className={cn(
        'relative w-[280px] rounded-lg border bg-background shadow-sm transition-all cursor-pointer',
        'hover:shadow-md',
        selected && 'ring-2 ring-primary shadow-md',
        isMissing && 'border-dashed border-red-300 dark:border-red-800'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-2 !h-2 !border-0" />

      {/* Confidence bar on the left */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg',
          confidenceBarColors[step.confidence]
        )}
      />

      <div className="pl-3 pr-3 py-2.5 space-y-1.5">
        {/* Row 1: step number + name */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {index + 1}.
          </span>
          <span className="text-sm font-medium truncate flex-1">
            {step.name || (
              <span className="text-muted-foreground italic">Unnamed step</span>
            )}
          </span>
        </div>

        {/* Row 2: systems + confidence badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {systemsToShow.map((sys) => (
              <span
                key={sys.name}
                className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground truncate max-w-[70px]"
              >
                {sys.name}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                +{extraCount}
              </span>
            )}
          </div>
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0',
              confidenceBadgeColors[step.confidence]
            )}
          >
            {step.confidence}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400 !w-2 !h-2 !border-0" />
    </div>
  );
}

export const StepNode = memo(StepNodeComponent);
