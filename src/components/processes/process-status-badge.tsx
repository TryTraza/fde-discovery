const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  mapping: 'bg-blue-100 text-blue-700',
  validated: 'bg-green-100 text-green-700',
  locked: 'bg-amber-100 text-amber-700',
};

interface ProcessStatusBadgeProps {
  status: string;
}

export function ProcessStatusBadge({ status }: ProcessStatusBadgeProps) {
  const colors = statusColors[status] ?? statusColors.draft;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors}`}>
      {status}
    </span>
  );
}
