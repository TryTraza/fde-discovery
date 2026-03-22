import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface TerminalNodeData {
  label: 'Start' | 'End';
  [key: string]: unknown;
}

function TerminalNodeComponent({ data }: NodeProps) {
  const { label } = data as TerminalNodeData;
  const isStart = label === 'Start';

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full w-12 h-12 text-xs font-semibold shadow-sm border',
        isStart
          ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
          : 'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700'
      )}
    >
      {label}
      {isStart ? (
        <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-2 !h-2 !border-0" />
      ) : (
        <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-2 !h-2 !border-0" />
      )}
    </div>
  );
}

export const TerminalNode = memo(TerminalNodeComponent);
