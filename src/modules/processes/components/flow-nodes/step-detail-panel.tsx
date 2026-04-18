'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Trash2, Plus, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, labelVariants } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ProcessStepParsed } from '@/lib/validations/process'

const confidenceBadgeColors = {
  confirmed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  inferred: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  missing: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
}

interface StepDetailPanelProps {
  open: boolean
  step: ProcessStepParsed | null
  stepIndex: number
  totalSteps: number
  onUpdate: (id: string, field: keyof ProcessStepParsed, value: unknown) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onClose: () => void
}

export function StepDetailPanel({
  open,
  step,
  stepIndex,
  totalSteps,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onClose,
}: StepDetailPanelProps) {
  const [newSystem, setNewSystem] = useState('')

  if (!step) return null

  const isMissing = step.confidence === 'missing'

  const addSystem = () => {
    const name = newSystem.trim()
    if (!name) return
    if (step.systems.some((s) => s.name.toLowerCase() === name.toLowerCase())) return
    onUpdate(step.id, 'systems', [...step.systems, { name, confirmed: false, detailNotes: '' }])
    setNewSystem('')
  }

  const removeSystem = (systemName: string) => {
    onUpdate(
      step.id,
      'systems',
      step.systems.filter((s) => s.name !== systemName)
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between pr-2">
            <SheetTitle className="text-base">
              Step {stepIndex + 1}: {step.name || 'Unnamed'}
            </SheetTitle>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onMoveUp(step.id)}
                disabled={stepIndex === 0}
                title="Move up"
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onMoveDown(step.id)}
                disabled={stepIndex >= totalSteps - 1}
                title="Move down"
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  onDelete(step.id)
                  onClose()
                }}
                className="text-muted-foreground hover:text-destructive"
                title="Delete step"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {/* Name */}
          <div className="space-y-1">
            <Label variant="field">Name</Label>
            <Input
              value={step.name}
              onChange={(e) => onUpdate(step.id, 'name', e.target.value)}
              placeholder="Step name"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label variant="field">Description</Label>
            <Textarea
              value={step.description}
              onChange={(e) => onUpdate(step.id, 'description', e.target.value)}
              className="resize-none"
              placeholder="Step description"
              rows={3}
            />
          </div>

          {/* Confidence */}
          <div className="space-y-1">
            <Label variant="field">Confidence</Label>
            <Select
              value={step.confidence}
              onValueChange={(val) => onUpdate(step.id, 'confidence', val)}
            >
              <SelectTrigger
                className={cn(
                  'h-auto text-xs px-2 py-1 rounded-full border-0 w-auto',
                  confidenceBadgeColors[step.confidence]
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">confirmed</SelectItem>
                <SelectItem value="inferred">inferred</SelectItem>
                <SelectItem value="missing">missing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Systems */}
          <div className="space-y-1">
            <Label variant="field">Systems</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {step.systems.map((system) => (
                <span
                  key={system.name}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                >
                  {system.name}
                  {system.confirmed && <span className="text-green-600">&#10003;</span>}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeSystem(system.name)}
                    className="ml-0.5 hover:text-destructive h-auto w-auto p-0"
                    aria-label={`Remove ${system.name}`}
                  >
                    <X className="size-3" />
                  </Button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  addSystem()
                }}
                className="inline-flex items-center gap-1"
              >
                <Input
                  value={newSystem}
                  onChange={(e) => setNewSystem(e.target.value)}
                  placeholder="+ system"
                  className="h-7 w-24 text-xs px-2"
                />
                {newSystem.trim() && (
                  <Button type="submit" variant="ghost" size="icon-xs">
                    <Plus className="size-3" />
                  </Button>
                )}
              </form>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label variant="field">Notes</Label>
            <Textarea
              value={step.notes}
              onChange={(e) => onUpdate(step.id, 'notes', e.target.value)}
              className="resize-none"
              placeholder="Notes about this step"
              rows={3}
            />
          </div>

          {/* Edge cases (read-only) */}
          {step.edgeCases.length > 0 && (
            <div className="space-y-1">
              <div className={cn(labelVariants({ variant: 'field' }))}>Edge Cases</div>
              <ul className="text-sm list-disc list-inside text-muted-foreground">
                {step.edgeCases.map((ec: any, i: number) => (
                  <li key={i}>
                    {typeof ec === 'string' ? ec : (ec.description ?? JSON.stringify(ec))}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gap warning */}
          {isMissing && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
              This step has a gap — consider scheduling a shadowing session to observe it.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
