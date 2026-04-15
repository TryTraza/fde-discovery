'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getEventTypeConfig } from '@/lib/capture/event-types'
import { X, Pencil, Check } from 'lucide-react'
import type { LocalEvent } from '@/lib/hooks/use-event-sync'

interface EventLogPanelProps {
  events: LocalEvent[]
  onUpdateEventField: (localId: string, field: 'label' | 'detail', value: string) => void
  onRemoveEvent?: (localId: string) => void
  readOnly?: boolean
}

function EventLogEntry({
  event,
  onUpdateField,
  onRemove,
  readOnly,
}: {
  event: LocalEvent
  onUpdateField: (localId: string, field: 'label' | 'detail', value: string) => void
  onRemove?: (localId: string) => void
  readOnly?: boolean
}) {
  const config = getEventTypeConfig(event.type)
  const ts = new Date(event.timestamp)
  const timeStr = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}:${String(ts.getSeconds()).padStart(2, '0')}`

  // Determine the editable field and its current value
  const editableField: 'label' | 'detail' = event.type === 'QUESTION' ? 'detail' : 'label'
  const currentValue = event.type === 'QUESTION' ? (event.detail ?? '') : (event.label ?? '')

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // For IMPLICIT and QUESTION, start in editing mode if empty
  const isInstantType = event.type === 'IMPLICIT' || event.type === 'QUESTION'

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  function getDisplayText() {
    if (event.type === 'SYSTEM') {
      return event.label ? `${event.label}${event.detail ? ` — ${event.detail}` : ''}` : ''
    }
    if (event.type === 'QUESTION') return event.detail || ''
    return event.label || ''
  }

  const displayText = getDisplayText()
  const placeholder = isInstantType
    ? event.type === 'QUESTION'
      ? 'What do you want to ask?'
      : 'Add a label...'
    : 'Edit...'

  function handleSave() {
    const trimmed = editValue.trim()
    if (trimmed !== currentValue) {
      onUpdateField(event.localId, editableField, trimmed)
    }
    setIsEditing(false)
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-1 rounded-md text-sm group hover:bg-muted/50 transition-colors">
      <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
        {timeStr}
      </span>
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${config.dotColor}`} />
      <span className="text-[11px] font-medium text-muted-foreground w-14 flex-shrink-0 truncate">
        {config.label}
      </span>
      <div className="flex-1 min-w-0">
        {readOnly ? (
          <span className="text-sm">
            {displayText || <span className="text-muted-foreground italic">—</span>}
          </span>
        ) : isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') {
                  setEditValue(currentValue)
                  setIsEditing(false)
                }
              }}
              onBlur={handleSave}
              placeholder={placeholder}
              className="h-7 text-sm flex-1"
            />
          </div>
        ) : (
          <button
            onClick={() => {
              setEditValue(currentValue)
              setIsEditing(true)
            }}
            className="text-sm text-left w-full truncate hover:underline decoration-dashed underline-offset-2 cursor-text"
          >
            {displayText || <span className="text-muted-foreground italic">{placeholder}</span>}
          </button>
        )}
      </div>
      {!readOnly && !isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setEditValue(currentValue)
              setIsEditing(true)
            }}
          >
            <Pencil className="size-3" />
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onRemove(event.localId)}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function EventLogPanel({
  events,
  onUpdateEventField,
  onRemoveEvent,
  readOnly,
}: EventLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm p-8 gap-1">
        <p>No events yet</p>
        <p className="text-xs">Select an event type above to start logging</p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
      {events.map((event) => (
        <EventLogEntry
          key={event.localId}
          event={event}
          onUpdateField={onUpdateEventField}
          onRemove={onRemoveEvent}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}
