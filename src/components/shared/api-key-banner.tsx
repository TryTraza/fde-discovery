'use client'

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { KeyRound } from 'lucide-react'
export function ApiKeyBanner() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) return null

  const hasApiKey = (user?.publicMetadata as Record<string, unknown>)?.hasApiKey

  if (hasApiKey) return null

  return (
    <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertTitle className="text-amber-800 dark:text-amber-400">
        Anthropic API key not configured
      </AlertTitle>
      <AlertDescription className="text-amber-700/90 dark:text-amber-400/80">
        AI features require an API key to work.{' '}
        <Link
          href="/settings"
          className="font-medium text-amber-800 underline underline-offset-4 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
        >
          Configure in Settings &rarr;
        </Link>
      </AlertDescription>
    </Alert>
  )
}
