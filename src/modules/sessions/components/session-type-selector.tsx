'use client'

import { Users, Route, Eye, FileText, Monitor } from 'lucide-react'

const SESSION_TYPES = [
  {
    value: 'discovery',
    label: 'Discovery',
    description: 'Talk to key decision-makers',
    icon: Users,
  },
  {
    value: 'process_mapping',
    label: 'Process Mapping',
    description: 'Walk through step by step with an operator',
    icon: Route,
  },
  {
    value: 'shadowing',
    label: 'Shadowing',
    description: 'Observe an operator live',
    icon: Eye,
  },
  {
    value: 'validation',
    label: 'Validation',
    description: 'Review SOPs, system exports',
    icon: FileText,
  },
  {
    value: 'demo',
    label: 'Demo',
    description: 'Watch system demonstrations',
    icon: Monitor,
  },
] as const

interface SessionTypeSelectorProps {
  onSelect: (type: string) => void
}

export function SessionTypeSelector({ onSelect }: SessionTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {SESSION_TYPES.map(({ value, label, description, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-center size-10 rounded-full bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium leading-tight">{label}</p>
            <p className="text-[11px] leading-tight text-muted-foreground">{description}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
