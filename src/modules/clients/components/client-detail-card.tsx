'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from './status-badge'
import { CollapsibleCard } from '@/components/shared/collapsible-card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { clientsService } from '@/modules/clients/services/clients-service'
import { ApiError } from '@/lib/api-client'
import type { Client, ClientUpdateInput } from '@/modules/clients/types'

interface ClientDetailCardProps {
  client: Client
  clientId: string
  mutateClient: () => void
}

const STATUS_OPTIONS = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'active_poc', label: 'Active POC' },
  { value: 'demo_ready', label: 'Demo Ready' },
  { value: 'closed', label: 'Closed' },
]

export function ClientDetailCard({ client, clientId, mutateClient }: ClientDetailCardProps) {
  const [saving, setSaving] = useState(false)

  async function patchField(field: keyof ClientUpdateInput, value: string, originalValue: string) {
    if (value === originalValue) return
    setSaving(true)
    try {
      await clientsService.update(clientId, { [field]: value } as ClientUpdateInput)
      mutateClient()
    } catch (error) {
      const message =
        error instanceof ApiError && typeof (error.body as { error?: string })?.error === 'string'
          ? (error.body as { error: string }).error
          : 'Failed to save'
      toast.error(message)
      mutateClient()
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleCard
      title="Details"
      actions={
        saving ? <span className="text-xs text-muted-foreground">Saving...</span> : undefined
      }
    >
      <div className="space-y-4">
        <InlineField
          label="Name"
          value={client.name}
          onBlur={(val) => patchField('name', val, client.name)}
        />
        <InlineField
          label="Industry"
          value={client.industry}
          onBlur={(val) => patchField('industry', val, client.industry)}
        />
        <InlineField
          label="Website"
          value={client.website ?? ''}
          onBlur={(val) => patchField('website', val, client.website ?? '')}
        />
        <InlineField
          label="HQ Location"
          value={client.hqLocation ?? ''}
          onBlur={(val) => patchField('hqLocation', val, client.hqLocation ?? '')}
        />
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <div className="flex items-center gap-2">
            <StatusBadge status={client.status} />
            <Select
              value={client.status}
              onValueChange={(val) => {
                if (val && val !== client.status) patchField('status', val, client.status)
              }}
            >
              <SelectTrigger size="sm" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <InlineTextarea
            value={client.notes ?? ''}
            onBlur={(val) => patchField('notes', val, client.notes ?? '')}
          />
        </div>
      </div>
    </CollapsibleCard>
  )
}

function InlineField({
  label,
  value,
  onBlur,
}: {
  label: string
  value: string
  onBlur: (val: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onBlur(localValue)}
        className="h-8"
      />
    </div>
  )
}

function InlineTextarea({ value, onBlur }: { value: string; onBlur: (val: string) => void }) {
  const [localValue, setLocalValue] = useState(value)

  return (
    <Textarea
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onBlur(localValue)}
      rows={3}
    />
  )
}
