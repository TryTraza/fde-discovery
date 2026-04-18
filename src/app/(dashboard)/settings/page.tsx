'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, EyeOff } from 'lucide-react'
import { settingsService } from '@/modules/settings/services/settings-service'
import { ApiError } from '@/lib/api-client'

export default function SettingsPage() {
  const { isLoaded, user } = useUser()
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [inFlight, setInFlight] = useState(false)

  // API key state
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [keyError, setKeyError] = useState('')

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await settingsService.get()
        setHasApiKey(data.hasApiKey)
      } catch {
        toast.error('Failed to load settings')
      } finally {
        setSettingsLoaded(true)
      }
    }
    fetchSettings()
  }, [])

  // Loading gate: show skeleton until both Clerk and GET are resolved
  if (!isLoaded || !settingsLoaded) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  function validateKey(value: string): string {
    if (!value.trim()) return 'API key cannot be empty'
    if (!value.startsWith('sk-ant-')) return 'API key must start with sk-ant-'
    return ''
  }

  async function handleSaveKey() {
    const error = validateKey(apiKey)
    if (error) {
      setKeyError(error)
      return
    }
    setKeyError('')
    setInFlight(true)
    try {
      await settingsService.updateApiKey(apiKey)
      setHasApiKey(true)
      setApiKey('')
      await user?.reload()
      toast.success('API key saved successfully')
    } catch (err) {
      const message =
        err instanceof ApiError && typeof (err.body as { error?: string })?.error === 'string'
          ? (err.body as { error: string }).error
          : err instanceof Error
            ? err.message
            : 'Failed to save API key'
      toast.error(message)
    } finally {
      setInFlight(false)
    }
  }

  async function handleTestKey() {
    setInFlight(true)
    try {
      await settingsService.testKey()
      toast.success('API key is valid!')
    } catch (err) {
      const message =
        err instanceof ApiError && typeof (err.body as { error?: string })?.error === 'string'
          ? (err.body as { error: string }).error
          : err instanceof Error
            ? err.message
            : 'Key test failed'
      toast.error(message)
    } finally {
      setInFlight(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl w-full">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* API Key Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Anthropic API Key</CardTitle>
              <CardDescription>
                Your API key is stored securely and used for all AI features.
              </CardDescription>
            </div>
            {hasApiKey && (
              <Badge variant="secondary" className="text-green-700 bg-green-100">
                API key configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-2">
            <Label htmlFor="api-key">{hasApiKey ? 'Update API Key' : 'Enter API Key'}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setKeyError('')
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={handleSaveKey} disabled={inFlight}>
                {hasApiKey ? 'Update' : 'Save'}
              </Button>
            </div>
            {keyError && <p className="text-sm text-destructive">{keyError}</p>}
          </div>
          {hasApiKey && (
            <Button variant="outline" onClick={handleTestKey} disabled={inFlight}>
              Test Key
            </Button>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
