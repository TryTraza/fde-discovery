'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ProcessStatusBadge } from './process-status-badge'
import { VALID_TRANSITIONS, type ProcessStatus } from '@/lib/validations/process'
import { processesService } from '@/modules/processes/services/processes-service'
import { ApiError } from '@/lib/api-client'
import { SlidersHorizontal } from 'lucide-react'
import { CollapsibleCard } from '@/components/shared/collapsible-card'
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

interface ProcessDetailCardProps {
  process: any
  clientId: string
  mutateProcess: (...args: any[]) => any
}

export function ProcessDetailCard({ process, clientId, mutateProcess }: ProcessDetailCardProps) {
  const [saving, setSaving] = useState(false)

  const patchField = async (field: string, value: string, originalValue: string) => {
    if (value === originalValue) return
    setSaving(true)
    try {
      await processesService.update(clientId, process.id, { [field]: value || null })
      mutateProcess()
    } catch (error) {
      const message =
        error instanceof ApiError && typeof (error.body as { error?: string })?.error === 'string'
          ? (error.body as { error: string }).error
          : 'Failed to save'
      toast.error(message)
      mutateProcess()
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === process.status) return
    setSaving(true)
    try {
      await processesService.update(clientId, process.id, { status: newStatus })
      mutateProcess()
      toast.success(`Status updated to ${newStatus}`)
    } catch (error) {
      const message =
        error instanceof ApiError && typeof (error.body as { error?: string })?.error === 'string'
          ? (error.body as { error: string }).error
          : 'Failed to update status'
      toast.error(message)
      mutateProcess()
    } finally {
      setSaving(false)
    }
  }

  const currentStatus = process.status as ProcessStatus
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? []

  return (
    <CollapsibleCard
      title="Details"
      icon={SlidersHorizontal}
      actions={saving ? <span className="text-xs text-muted-foreground">Saving...</span> : undefined}
    >
      <div className="space-y-1">
        <InlineField
          label="Name"
          value={process.name}
          onBlur={(val) => patchField('name', val, process.name)}
        />
        <div className="space-y-1">
          <Label variant="field">Status</Label>
          <div className="flex items-center gap-2">
            <ProcessStatusBadge status={process.status} />
            {allowedTransitions.length > 0 ? (
              <Select value={process.status} onValueChange={handleStatusChange}>
                <SelectTrigger size="sm" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={process.status}>{process.status}</SelectItem>
                  {allowedTransitions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs text-muted-foreground">(locked)</span>
            )}
          </div>
        </div>
        <InlineField
          label="Department"
          value={process.departmentTag ?? ''}
          onBlur={(val) => patchField('departmentTag', val, process.departmentTag ?? '')}
          placeholder="Add department..."
        />
        <div className="space-y-1">
          <Label variant="field">Description</Label>
          <InlineTextarea
            value={process.description ?? ''}
            onBlur={(val) => patchField('description', val, process.description ?? '')}
            placeholder="Add description..."
          />
        </div>
        {process.processTypeL1 && (
          <div className="space-y-1">
            <Label variant="field">Process Type</Label>
            <p className="text-sm">{process.processTypeL1}</p>
          </div>
        )}
      </div>
    </CollapsibleCard>
  )
}

function InlineField({
  label,
  value,
  onBlur,
  placeholder,
}: {
  label: string
  value: string
  onBlur: (val: string) => void
  placeholder?: string
}) {
  const [localValue, setLocalValue] = useState(value)

  return (
    <div className="space-y-1">
      <Label variant="field">{label}</Label>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onBlur(localValue)}
        placeholder={placeholder}
      />
    </div>
  )
}

function InlineTextarea({
  value,
  onBlur,
  placeholder,
}: {
  value: string
  onBlur: (val: string) => void
  placeholder?: string
}) {
  const [localValue, setLocalValue] = useState(value)

  return (
    <Textarea
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onBlur(localValue)}
      placeholder={placeholder}
      rows={3}
    />
  )
}
