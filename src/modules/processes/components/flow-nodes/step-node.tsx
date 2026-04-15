import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { ProcessStepParsed } from '@/lib/validations/process'

const confidenceConfig = {
  confirmed: {
    border: 'border-emerald-400 dark:border-emerald-600',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    badge: 'bg-emerald-200/80 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-300',
    accent: '#10b981',
  },
  inferred: {
    border: 'border-amber-300 dark:border-amber-600',
    bg: 'bg-amber-50/80 dark:bg-amber-950/40',
    badge: 'bg-amber-200/80 text-amber-800 dark:bg-amber-900/80 dark:text-amber-300',
    accent: '#fbbf24',
  },
  missing: {
    border: 'border-red-300 dark:border-red-600',
    bg: 'bg-red-50/80 dark:bg-red-950/40',
    badge: 'bg-red-200/80 text-red-800 dark:bg-red-900/80 dark:text-red-300',
    accent: '#f87171',
  },
}

interface StepNodeData {
  step: ProcessStepParsed
  index: number
  [key: string]: unknown
}

/** Generate a stable slightly-irregular border-radius to feel hand-drawn */
function useSketchyRadius(seed: number) {
  return useMemo(() => {
    const s = Math.sin(seed * 9301 + 49297) * 233280
    const r = (i: number) => {
      const v = Math.abs(Math.sin(s + i * 127.1)) * 6
      return 8 + v // 8–14px range
    }
    return `${r(0)}px ${r(1)}px ${r(2)}px ${r(3)}px`
  }, [seed])
}

function StepNodeComponent({ data, selected }: NodeProps) {
  const { step, index } = data as StepNodeData
  const conf = confidenceConfig[step.confidence]
  const isMissing = step.confidence === 'missing'
  const systemsToShow = step.systems.slice(0, 4)
  const extraCount = step.systems.length - 4

  const borderRadius = useSketchyRadius(index)

  return (
    <div
      className={cn(
        'group relative w-[280px] border-[1.5px] transition-all duration-200 cursor-pointer',
        'shadow-[2px_3px_0px_0px_rgba(0,0,0,0.08)] dark:shadow-[2px_3px_0px_0px_rgba(255,255,255,0.05)]',
        'hover:shadow-[3px_4px_0px_0px_rgba(0,0,0,0.12)] hover:-translate-y-0.5',
        conf.border,
        conf.bg,
        selected &&
          'shadow-[3px_4px_0px_0px_rgba(0,0,0,0.15)] -translate-y-0.5 ring-2 ring-primary/30',
        isMissing && 'border-dashed'
      )}
      style={{
        borderRadius,
        filter: 'url(#sketchy-filter)',
      }}
    >
      {/* Top handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-background !border-[1.5px] !border-muted-foreground/50 !rounded-full !-top-[7px]"
      />

      <div className="px-3.5 py-3 space-y-2" style={{ fontFamily: 'var(--font-hand), cursive' }}>
        {/* Row 1: step number + name */}
        <div className="flex items-start gap-2 min-w-0">
          <span className="flex-shrink-0 text-base font-bold text-muted-foreground/70 tabular-nums leading-none mt-0.5">
            {index + 1}.
          </span>
          <span className="text-[17px] font-semibold leading-snug line-clamp-2 flex-1">
            {step.name || <span className="text-muted-foreground/50 italic">Unnamed step</span>}
          </span>
        </div>

        {/* Row 2: systems + confidence */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
            {systemsToShow.map((sys) => (
              <span
                key={sys.name}
                title={sys.name}
                className="text-[13px] px-1.5 py-0.5 rounded-md bg-background/60 text-muted-foreground truncate max-w-[70px] border border-border/50"
              >
                {sys.name}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="text-[13px] text-muted-foreground/60 font-medium">
                +{extraCount}
              </span>
            )}
          </div>
          <span
            className={cn(
              'text-[12px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 capitalize',
              conf.badge
            )}
          >
            {step.confidence}
          </span>
        </div>
      </div>

      {/* Bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-background !border-[1.5px] !border-muted-foreground/50 !rounded-full !-bottom-[7px]"
      />
    </div>
  )
}

export const StepNode = memo(StepNodeComponent)
