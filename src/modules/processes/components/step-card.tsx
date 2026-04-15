'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, ChevronDown, ChevronRight, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ProcessStepParsed } from '@/lib/validations/process'

const confidenceColors = {
  confirmed: 'bg-green-100 text-green-700',
  inferred: 'bg-yellow-100 text-yellow-700',
  missing: 'bg-gray-100 text-gray-500',
}

interface StepCardProps {
  step: ProcessStepParsed
  index: number
  onUpdate: (id: string, field: keyof ProcessStepParsed, value: unknown) => void
  onDelete: (id: string) => void
}

export function StepCard({ step, index, onUpdate, onDelete }: StepCardProps) {
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

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-background">
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-5" />
        </button>

        {/* Order number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Input
              value={step.name}
              onChange={(e) => onUpdate(step.id, 'name', e.target.value)}
              className="h-8 font-medium text-sm"
              placeholder="Step name"
            />
            <select
              value={step.confidence}
              onChange={(e) => onUpdate(step.id, 'confidence', e.target.value)}
              className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${confidenceColors[step.confidence]}`}
            >
              <option value="confirmed">confirmed</option>
              <option value="inferred">inferred</option>
              <option value="missing">missing</option>
            </select>
          </div>

          <Textarea
            value={step.description}
            onChange={(e) => onUpdate(step.id, 'description', e.target.value)}
            className="text-sm min-h-[36px] resize-none"
            placeholder="Step description"
            rows={1}
          />

          {/* Systems — always visible, editable */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {step.systems.map((system) => (
              <span
                key={system.name}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
              >
                {system.name}
                {system.confirmed && <span className="text-green-600">&#10003;</span>}
                <button
                  onClick={() => removeSystem(system.name)}
                  className="ml-0.5 hover:text-destructive"
                  aria-label={`Remove ${system.name}`}
                >
                  <X className="size-3" />
                </button>
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

          {/* Expandable details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {step.edgeCases.length > 0
              ? `${step.edgeCases.length} edge case${step.edgeCases.length !== 1 ? 's' : ''}`
              : 'Details'}
            {step.notes ? ' · has notes' : ''}
          </button>

          {expanded && (
            <div className="mt-2 pt-2 border-t space-y-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={step.notes}
                  onChange={(e) => onUpdate(step.id, 'notes', e.target.value)}
                  className="text-sm min-h-[36px] resize-none mt-1"
                  placeholder="Notes about this step"
                  rows={2}
                />
              </div>
              {step.edgeCases.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Edge Cases</span>
                  <ul className="text-sm list-disc list-inside">
                    {step.edgeCases.map((ec: any, i: number) => (
                      <li key={i}>
                        {typeof ec === 'string' ? ec : (ec.description ?? JSON.stringify(ec))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(step.id)}
          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Delete step"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
