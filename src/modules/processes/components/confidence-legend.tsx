import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfidenceLegendProps {
  onAddStep: () => void
}

const LEVELS = [
  { label: 'Confirmed', color: 'bg-emerald-500' },
  { label: 'Inferred', color: 'bg-amber-400' },
  { label: 'Gap', color: 'bg-red-400' },
] as const

export function ConfidenceLegend({ onAddStep }: ConfidenceLegendProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {LEVELS.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span data-testid="confidence-indicator" className={`size-2.5 rounded-full ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAddStep}>
        <Plus className="size-3.5 mr-1" />
        Add Step
      </Button>
    </div>
  )
}
