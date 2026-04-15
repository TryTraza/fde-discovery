import { parseProcessSteps } from '@/lib/validations/process'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

interface MetadataStripProps {
  process: any
  sessionCount: number
  completedSessionCount: number
  onEditClick: () => void
}

export function MetadataStrip({
  process,
  sessionCount,
  completedSessionCount,
  onEditClick,
}: MetadataStripProps) {
  const steps = parseProcessSteps(process.processModel?.steps)
  const confirmed = steps.filter((s) => s.confidence === 'confirmed').length
  const inferred = steps.filter((s) => s.confidence === 'inferred').length
  const missing = steps.filter((s) => s.confidence === 'missing').length

  return (
    <div className="flex items-center gap-4 flex-wrap rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Dept:</span>
        <span className="font-medium">{process.departmentTag || '—'}</span>
      </div>

      <Separator />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Type:</span>
        <span className="font-medium">{process.processTypeL1 || '—'}</span>
      </div>

      <Separator />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{steps.length} steps</span>
        {steps.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{confirmed}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">{inferred}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-600 dark:text-red-400 font-medium">{missing}</span>
          </span>
        )}
      </div>

      <Separator />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Sessions:</span>
        <span className="font-medium text-xs">
          {completedSessionCount} / {sessionCount}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-xs"
        onClick={onEditClick}
        aria-label="Edit details"
      >
        <Pencil className="size-3 mr-1" />
        Edit details
      </Button>
    </div>
  )
}

function Separator() {
  return <div className="h-4 w-px bg-border" />
}
