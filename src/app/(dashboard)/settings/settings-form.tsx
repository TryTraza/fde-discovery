'use client'

import { useState } from 'react'
import useSWR from 'swr'
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

function extractError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && typeof (err.body as { error?: string })?.error === 'string') {
    return (err.body as { error: string }).error
  }
  return err instanceof Error ? err.message : fallback
}

export function SettingsForm() {
  const { user } = useUser()
  const { data, isLoading } = useSWR('/api/settings', () => settingsService.get())
  const hasApiKey = data?.hasApiKey ?? false

  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
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
    if (error) { setKeyError(error); return }
    setKeyError('')
    setSaving(true)
    try {
      await settingsService.updateApiKey(apiKey)
      setApiKey('')
      await user?.reload()
      toast.success('API key saved')
    } catch (err) {
      toast.error(extractError(err, 'Failed to save API key'))
    } finally {
      setSaving(false)
    }
  }

  async function handleTestKey() {
    setTesting(true)
    try {
      await settingsService.testKey()
      toast.success('API key is valid')
    } catch (err) {
      toast.error(extractError(err, 'Key test failed'))
    } finally {
      setTesting(false)
    }
  }

  return (
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
              Configured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="api-key">{hasApiKey ? 'Update API Key' : 'Enter API Key'}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyError('') }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={handleSaveKey} disabled={saving}>
              {saving ? 'Saving...' : hasApiKey ? 'Update' : 'Save'}
            </Button>
          </div>
          {keyError && <p className="text-sm text-destructive">{keyError}</p>}
        </div>
        {hasApiKey && (
          <Button variant="outline" onClick={handleTestKey} disabled={testing}>
            {testing ? 'Testing...' : 'Test Key'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
