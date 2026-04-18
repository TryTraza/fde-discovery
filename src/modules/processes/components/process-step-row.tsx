'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const confidenceBarColors = {
  confirmed: 'bg-emerald-500',
  inferred: 'bg-amber-400',
  missing: 'bg-red-400',
}

interface ProcessStepRowProps {
  step: ProcessStepParsed
  index: number
  onUpdate: (id: string, field: keyof ProcessStepParsed, value: unknown) => void
  onDelete: (id: string) => void
}

export function ProcessStepRow({ step, index, onUpdate, onDelete }: ProcessStepRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [newSystem, setNewSystem] = useState('')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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

  const isMissing = step.confidence === 'missing'
  const systemsToShow = step.systems.slice(0, 3)
  const extraCount = step.systems.length - 3

  return (
    <div ref={setNodeRef} style={style}>
      {/* Collapsed row */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 bg-background cursor-pointer hover:bg-muted/30 transition-colors',
          isMissing && 'border-dashed border-red-300 dark:border-red-800',
          expanded && 'rounded-b-none border-b-0'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Drag handle */}
        <Button
          variant="ghost"
          size="icon-sm"
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-4" />
        </Button>

        {/* Confidence bar */}
        <div
          className={`w-1 self-stretch rounded-full flex-shrink-0 ${confidenceBarColors[step.confidence]}`}
        />

        {/* Step number */}
        <span className="text-xs text-muted-foreground flex-shrink-0 w-5 text-center">
          {index + 1}
        </span>

        {/* Step name */}
        <span className="flex-1 min-w-0 truncate text-sm font-medium">
          {step.name || <span className="text-muted-foreground italic">Unnamed step</span>}
        </span>

        {/* System pills */}
        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          {systemsToShow.map((sys) => (
            <span
              key={sys.name}
              className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground truncate max-w-[80px]"
            >
              {sys.name}
            </span>
          ))}
          {extraCount > 0 && <span className="text-xs text-muted-foreground">+{extraCount}</span>}
        </div>

        {/* Confidence badge */}
        <span
          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${confidenceBadgeColors[step.confidence]}`}
        >
          {step.confidence}
        </span>

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(step.id)
          }}
          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Delete step"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div
          className={cn(
            'border border-t-0 rounded-b-lg px-4 py-3 space-y-3 bg-background',
            isMissing && 'border-dashed border-red-300 dark:border-red-800'
          )}
        >
          {/* Name input */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Name</Label>
            <Input
              value={step.name}
              onChange={(e) => onUpdate(step.id, 'name', e.target.value)}
              className="h-8 text-sm"
              placeholder="Step name"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Description</Label>
            <Textarea
              value={step.description}
              onChange={(e) => onUpdate(step.id, 'description', e.target.value)}
              className="text-sm min-h-[36px] resize-none"
              placeholder="Step description"
              rows={2}
            />
          </div>

          {/* Confidence */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Confidence</Label>
            <Select
              value={step.confidence}
              onValueChange={(val) => onUpdate(step.id, 'confidence', val)}
            >
              <SelectTrigger
                className={`h-auto text-xs px-2 py-1 rounded-full border-0 w-auto ${confidenceBadgeColors[step.confidence]}`}
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
            <Label className="text-xs font-medium text-muted-foreground">Systems</Label>
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
                  className="h-6 w-24 text-xs px-2"
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
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Textarea
              value={step.notes}
              onChange={(e) => onUpdate(step.id, 'notes', e.target.value)}
              className="text-sm min-h-[36px] resize-none"
              placeholder="Notes about this step"
              rows={2}
            />
          </div>

          {/* Edge cases */}
          {step.edgeCases.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Edge Cases</span>
              <ul className="text-sm list-disc list-inside text-muted-foreground">
                {step.edgeCases.map((ec: any, i: number) => (
                  <li key={i}>
                    {typeof ec === 'string' ? ec : (ec.description ?? JSON.stringify(ec))}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gap note */}
          {isMissing && (
            <p className="text-xs text-red-600 dark:text-red-400">
              This step has a gap — consider scheduling a shadowing session to observe it.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
