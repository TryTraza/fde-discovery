'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { SlidersHorizontal } from 'lucide-react'
import { CollapsibleCard } from '@/components/shared/collapsible-card'
import { ClientStageStepper } from './client-stage-stepper'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { clientsService } from '@/modules/clients/services/clients-service'
import { ApiError } from '@/lib/api-client'
import { useRole } from '@/lib/hooks/use-role'
import type { Client, ClientUpdateInput } from '@/modules/clients/types'

interface ClientDetailCardProps {
  client: Client
  clientId: string
  mutateClient: () => void
}

export function ClientDetailCard({ client, clientId, mutateClient }: ClientDetailCardProps) {
  const [saving, setSaving] = useState(false)
  const { isAdmin } = useRole()

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
      icon={SlidersHorizontal}
      actions={saving ? <span className="text-xs text-muted-foreground">Saving...</span> : undefined}
    >
      <div className="space-y-1">
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
          <Label variant="field">Notes</Label>
          <InlineTextarea
            value={client.notes ?? ''}
            onBlur={(val) => patchField('notes', val, client.notes ?? '')}
          />
        </div>
        <div className="space-y-1 pt-2">
          <Label variant="field">Stage</Label>
          <ClientStageStepper
            clientId={clientId}
            status={client.status}
            onUpdated={mutateClient}
            disabled={!isAdmin}
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
      <Label variant="field">{label}</Label>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onBlur(localValue)}
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
