'use client';

import { useUser } from '@clerk/nextjs';

export function useRole() {
  const { user } = useUser();
  const meta = user?.publicMetadata as any;
  return {
    role: meta?.role ?? 'viewer',
    isAdmin: meta?.role === 'admin',
    isViewer: meta?.role !== 'admin',
    hasApiKey: !!meta?.hasApiKey,
  };
}
