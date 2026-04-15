import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TerminalNodeData {
  label: 'Start' | 'End'
  [key: string]: unknown
}

function TerminalNodeComponent({ data }: NodeProps) {
  const { label } = data as TerminalNodeData
  const isStart = label === 'Start'

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-5 py-2 border-[1.5px] transition-all',
        'shadow-[2px_2px_0px_0px_rgba(0,0,0,0.06)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.04)]',
        isStart
          ? 'bg-emerald-50/90 text-emerald-700 border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-600'
          : 'bg-zinc-50/90 text-zinc-500 border-zinc-300 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-600'
      )}
      style={{
        borderRadius: isStart ? '12px 10px 14px 9px' : '10px 13px 11px 14px',
        fontFamily: 'var(--font-hand), cursive',
        filter: 'url(#sketchy-filter)',
      }}
    >
      {isStart ? (
        <>
          <Play className="size-3.5 fill-current" />
          <span className="text-base font-semibold">Start</span>
          <Handle
            type="source"
            position={Position.Bottom}
            className="!w-2.5 !h-2.5 !bg-background !border-[1.5px] !border-emerald-400 !rounded-full !-bottom-[6px]"
          />
        </>
      ) : (
        <>
          <Square className="size-3 fill-current" />
          <span className="text-base font-semibold">End</span>
          <Handle
            type="target"
            position={Position.Top}
            className="!w-2.5 !h-2.5 !bg-background !border-[1.5px] !border-zinc-400 !rounded-full !-top-[6px]"
          />
        </>
      )}
    </div>
  )
}

export const TerminalNode = memo(TerminalNodeComponent)
