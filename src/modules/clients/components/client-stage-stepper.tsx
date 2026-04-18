'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Check, ArchiveX } from 'lucide-react'
import { clientsService } from '@/modules/clients/services/clients-service'
import type { ClientStatus } from '@/modules/clients/types'

const STAGES: { value: ClientStatus; label: string }[] = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'active_poc',  label: 'Active POC' },
  { value: 'contracted',  label: 'Contracted' },
  { value: 'expanding',   label: 'Expanding' },
]

interface ClientStageStepperProps {
  clientId: string
  status: ClientStatus
  onUpdated: () => void
  disabled?: boolean
}

export function ClientStageStepper({ clientId, status, onUpdated, disabled }: ClientStageStepperProps) {
  const [updating, setUpdating] = useState(false)
  const isInactive = status === 'inactive'
  const currentIdx = STAGES.findIndex((s) => s.value === status)

  async function setStage(value: ClientStatus) {
    if (value === status || updating || disabled) return
    setUpdating(true)
    try {
      await clientsService.update(clientId, { status: value })
      onUpdated()
    } catch {
      toast.error('Failed to update stage')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center">
        {STAGES.map((stage, idx) => {
          const isPast    = !isInactive && currentIdx > idx
          const isCurrent = !isInactive && currentIdx === idx
          const isFuture  = isInactive || currentIdx < idx

          return (
            <div key={stage.value} className="flex items-center">
              {idx > 0 && (
                <div
                  className={cn(
                    'h-px w-6 transition-colors',
                    isPast || isCurrent ? 'bg-foreground/30' : 'bg-border'
                  )}
                />
              )}
              <button
                onClick={() => setStage(stage.value)}
                disabled={updating || disabled}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
                  'disabled:cursor-not-allowed',
                  isCurrent && 'bg-foreground text-background',
                  isPast && 'bg-foreground/10 text-foreground/60 hover:bg-foreground/15',
                  isFuture && !isInactive && 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  isInactive && 'text-muted-foreground/50 cursor-default'
                )}
              >
                {isPast && <Check className="size-3" />}
                {stage.label}
              </button>
            </div>
          )
        })}
      </div>

      {isInactive ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setStage('prospecting')}
          disabled={updating || disabled}
        >
          Reactivate
        </Button>
      ) : (
        <button
          onClick={() => setStage('inactive')}
          disabled={updating || disabled}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:cursor-not-allowed"
        >
          <ArchiveX className="size-3.5" />
          Archive
        </button>
      )}
    </div>
  )
}
