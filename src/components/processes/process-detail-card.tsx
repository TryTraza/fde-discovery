'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ProcessStatusBadge } from './process-status-badge';
import { VALID_TRANSITIONS, type ProcessStatus } from '@/lib/validations/process';
import { CollapsibleCard } from '@/components/shared/collapsible-card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProcessDetailCardProps {
  process: any;
  clientId: string;
  mutateProcess: (...args: any[]) => any;
}

export function ProcessDetailCard({ process, clientId, mutateProcess }: ProcessDetailCardProps) {
  const [saving, setSaving] = useState(false);

  const patchField = async (field: string, value: string, originalValue: string) => {
    if (value === originalValue) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/processes/${process.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to save');
        mutateProcess();
        return;
      }
      mutateProcess();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === process.status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/processes/${process.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to update status');
        mutateProcess();
        return;
      }
      mutateProcess();
      toast.success(`Status updated to ${newStatus}`);
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = process.status as ProcessStatus;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? [];

  return (
    <CollapsibleCard
      title="Details"
      actions={saving ? <span className="text-xs text-muted-foreground">Saving...</span> : undefined}
    >
      <div className="space-y-4">
        <InlineField
          label="Name"
          value={process.name}
          onBlur={(val) => patchField('name', val, process.name)}
        />
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <div className="flex items-center gap-2">
            <ProcessStatusBadge status={process.status} />
            {allowedTransitions.length > 0 ? (
              <Select
                value={process.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger size="sm" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={process.status}>{process.status}</SelectItem>
                  {allowedTransitions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
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
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <InlineTextarea
            value={process.description ?? ''}
            onBlur={(val) => patchField('description', val, process.description ?? '')}
            placeholder="Add description..."
          />
        </div>
        {process.processTypeL1 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Process Type</label>
            <p className="text-sm">{process.processTypeL1}</p>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}

function InlineField({
  label,
  value,
  onBlur,
  placeholder,
}: {
  label: string;
  value: string;
  onBlur: (val: string) => void;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(value);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onBlur(localValue)}
        placeholder={placeholder}
        className="h-8"
      />
    </div>
  );
}

function InlineTextarea({
  value,
  onBlur,
  placeholder,
}: {
  value: string;
  onBlur: (val: string) => void;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(value);

  return (
    <Textarea
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onBlur(localValue)}
      placeholder={placeholder}
      rows={3}
    />
  );
}
