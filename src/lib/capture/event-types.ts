import type { EventType } from '@/lib/db/schema';

export interface EventTypeConfig {
  id: EventType;
  label: string;
  description: string;
  color: string;
  dotColor: string;
  shortcutKey?: string;
  behavior: 'input_panel' | 'system_picker' | 'instant_log';
}

export const EVENT_TYPE_CONFIG: EventTypeConfig[] = [
  {
    id: 'STEP',
    label: 'Step',
    description: 'A process step you observe',
    color: 'emerald',
    dotColor: 'bg-emerald-500',
    shortcutKey: 's',
    behavior: 'input_panel',
  },
  {
    id: 'EDGE',
    label: 'Edge Case',
    description: 'Exception or workaround',
    color: 'amber',
    dotColor: 'bg-amber-500',
    shortcutKey: 'e',
    behavior: 'input_panel',
  },
  {
    id: 'SYSTEM',
    label: 'System',
    description: 'Tool or app being used',
    color: 'violet',
    dotColor: 'bg-violet-500',
    shortcutKey: 'y',
    behavior: 'system_picker',
  },
  {
    id: 'IMPLICIT',
    label: 'Implicit',
    description: 'Undocumented knowledge',
    color: 'red',
    dotColor: 'bg-red-500',
    shortcutKey: 'i',
    behavior: 'instant_log',
  },
  {
    id: 'QUESTION',
    label: 'Question',
    description: 'Something to ask later',
    color: 'blue',
    dotColor: 'bg-blue-500',
    shortcutKey: 'q',
    behavior: 'instant_log',
  },
];

export const DEFAULT_SYSTEM_OPTIONS = [
  'Email', 'Excel', 'SharePoint', 'SAP', 'ERP', 'Browser', 'Phone', 'Other',
] as const;

export function getEventTypeConfig(type: EventType): EventTypeConfig {
  const config = EVENT_TYPE_CONFIG.find((c) => c.id === type);
  if (!config) throw new Error(`Unknown event type: ${type}`);
  return config;
}
