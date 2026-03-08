'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function ApiKeyGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;

  const hasApiKey = (user?.publicMetadata as Record<string, unknown>)?.hasApiKey;

  if (!hasApiKey) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>API Key Required</AlertTitle>
        <AlertDescription>
          You need to configure your Anthropic API key to use AI features.{' '}
          <Link href="/settings" className="underline font-medium">
            Go to Settings
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
