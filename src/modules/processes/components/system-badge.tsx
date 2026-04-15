interface SystemEntry {
  name: string;
  confirmed: boolean;
  detailNotes: string;
}

interface SystemBadgeProps {
  systemName: string;
  entry?: SystemEntry;
}

export function SystemBadge({ systemName, entry }: SystemBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
      title={entry?.detailNotes || undefined}
    >
      {systemName}
      {entry?.confirmed && (
        <span className="text-green-600">&#10003;</span>
      )}
    </span>
  );
}
