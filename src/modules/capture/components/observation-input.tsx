'use client'

import { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import type { EventType } from '@/lib/db/schema'

interface ObservationInputProps {
  selectedType: EventType | null
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function ObservationInput({
  selectedType,
  value,
  onChange,
  onSubmit,
  onCancel,
}: ObservationInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selectedType === 'STEP' || selectedType === 'EDGE') {
      inputRef.current?.focus()
    }
  }, [selectedType])

  if (selectedType !== 'STEP' && selectedType !== 'EDGE') {
    return null
  }

  const placeholder =
    selectedType === 'STEP' ? 'Describe the observed step...' : 'Describe the edge case...'

  return (
    <div className="px-4 py-2 border-b">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            onSubmit()
          }
          if (e.key === 'Escape') {
            onCancel()
          }
        }}
        placeholder={placeholder}
        className="min-h-[48px] text-base"
      />
    </div>
  )
}
