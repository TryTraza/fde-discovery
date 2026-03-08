'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff } from 'lucide-react';
import {
  AVAILABLE_MODELS,
  AI_FEATURE_LABELS,
  DEFAULT_MODELS,
  getModelLabel,
  type AIFeature,
} from '@/lib/ai/models';

type SettingsData = {
  hasApiKey: boolean;
  aiModels: Record<string, string>;
  role: string;
};

export default function SettingsPage() {
  const { isLoaded, user } = useUser();
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [inFlight, setInFlight] = useState(false);

  // API key state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  // Model preferences state
  const [aiModels, setAiModels] = useState<Record<string, string>>({});

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to fetch settings');
        const data: SettingsData = await res.json();
        setHasApiKey(data.hasApiKey);
        setAiModels(data.aiModels);
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setSettingsLoaded(true);
      }
    }
    fetchSettings();
  }, []);

  // Loading gate: show skeleton until both Clerk and GET are resolved
  if (!isLoaded || !settingsLoaded) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function validateKey(value: string): string {
    if (!value.trim()) return 'API key cannot be empty';
    if (!value.startsWith('sk-ant-')) return 'API key must start with sk-ant-';
    return '';
  }

  async function handleSaveKey() {
    const error = validateKey(apiKey);
    if (error) {
      setKeyError(error);
      return;
    }
    setKeyError('');
    setInFlight(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicApiKey: apiKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setHasApiKey(true);
      setApiKey('');
      await user?.reload();
      toast.success('API key saved successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setInFlight(false);
    }
  }

  async function handleTestKey() {
    setInFlight(true);
    try {
      const res = await fetch('/api/settings/test-key', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      toast.success('API key is valid!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Key test failed');
    } finally {
      setInFlight(false);
    }
  }

  async function handleSaveModels() {
    setInFlight(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiModels }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      await user?.reload();
      toast.success('Model preferences saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save model preferences');
    } finally {
      setInFlight(false);
    }
  }

  const features = Object.keys(AI_FEATURE_LABELS) as AIFeature[];

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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">
              {hasApiKey ? 'Update API Key' : 'Enter API Key'}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeyError('');
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

      {/* Model Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model Preferences</CardTitle>
          <CardDescription>
            Choose which Claude model to use for each AI feature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {features.map((feature) => {
            const selectedValue = aiModels[feature] || DEFAULT_MODELS[feature];
            return (
            <div key={feature} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <Label>{AI_FEATURE_LABELS[feature]}</Label>
              <Select
                value={selectedValue}
                onValueChange={(value) => {
                  if (value) setAiModels((prev) => ({ ...prev, [feature]: value }));
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <span className="truncate">{getModelLabel(selectedValue)}</span>
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            );
          })}
          <Button onClick={handleSaveModels} disabled={inFlight}>
            Save Model Preferences
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
