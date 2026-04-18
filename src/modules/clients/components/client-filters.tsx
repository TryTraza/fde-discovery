'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import { CLIENT_STATUSES } from '@/modules/clients/types'

interface ClientFiltersProps {
  searchValue: string
  onSearchChange: (value: string) => void
  statusValue: string
  onStatusChange: (value: string) => void
}

const STATUS_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  active_poc:  'Active POC',
  contracted:  'Contracted',
  expanding:   'Expanding',
  inactive:    'Inactive',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...CLIENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s })),
]

export function ClientFilters({
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
}: ClientFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <Select value={statusValue} onValueChange={(val) => onStatusChange(val ?? 'all')}>
        <SelectTrigger className="w-full sm:w-[160px]">
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
  )
}
