'use client';

import { EVENT_TYPE_CONFIG } from '@/lib/capture/event-types';
import type { EventType } from '@/lib/db/schema';

const COLOR_CLASSES: Record<string, { border: string; activeBg: string; text: string }> = {
  emerald: { border: 'border-emerald-500', activeBg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400' },
  amber: { border: 'border-amber-500', activeBg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400' },
  violet: { border: 'border-violet-500', activeBg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-400' },
  red: { border: 'border-red-500', activeBg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400' },
  blue: { border: 'border-blue-500', activeBg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400' },
};

interface EventTypeBarProps {
  selectedType: EventType | null;
  onSelectType: (type: EventType) => void;
}

export function EventTypeBar({ selectedType, onSelectType }: EventTypeBarProps) {
  return (
    <div className="px-4 pb-3 border-b space-y-2 min-w-0">
      <p className="text-xs text-muted-foreground">Select what you are observing</p>
      <div className="flex gap-1.5 overflow-x-auto min-w-0">
        {EVENT_TYPE_CONFIG.map((config) => {
          const colors = COLOR_CLASSES[config.color] ?? COLOR_CLASSES.blue;
          const isActive = selectedType === config.id;

          return (
            <button
              key={config.id}
              onClick={() => onSelectType(config.id)}
              className={`
                flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-left
                transition-colors flex-shrink-0
                ${isActive
                  ? `${colors.activeBg} ${colors.text} ${colors.border}`
                  : 'border-border bg-background hover:bg-muted'}
              `}
            >
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
                <span className="text-xs font-medium">{config.label}</span>
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">{config.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
