'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ProcessesSectionProps {
  processes: Array<{ id: string; name: string; status: string }>;
}

export function ProcessesSection({ processes }: ProcessesSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Processes</CardTitle>
      </CardHeader>
      <CardContent>
        {processes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No processes yet. Process management will be available in Phase 3.
          </p>
        ) : (
          <div className="space-y-2">
            {processes.map((process) => (
              <div
                key={process.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span className="font-medium">{process.name}</span>
                <span className="text-xs text-muted-foreground">{process.status}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
