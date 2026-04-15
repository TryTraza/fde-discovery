'use client'

import { useArtifacts } from '@/modules/artifacts/hooks/use-artifacts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useRef, useState } from 'react'
import {
  artifactsService,
  type Artifact,
  type ArtifactStage,
} from '@/modules/artifacts/services/artifacts-service'

interface ArtifactsPanelProps {
  clientId: string
  processId: string
  isAdmin: boolean
}

const MAX_FILE_SIZE = 25 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ArtifactsPanel({ clientId, processId, isAdmin }: ArtifactsPanelProps) {
  const { artifacts, isLoading, mutateArtifacts } = useArtifacts(clientId, processId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<ArtifactStage>('reference')

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 25MB.')
      return
    }

    setUploading(true)
    try {
      await artifactsService.upload(clientId, processId, file, uploadStage)
      toast.success('File uploaded')
      mutateArtifacts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(artifactId: string) {
    try {
      const { downloadUrl } = await artifactsService.getDownloadUrl(clientId, processId, artifactId)
      window.open(downloadUrl, '_blank')
    } catch {
      toast.error('Download failed')
    }
  }

  async function handleDelete(artifactId: string) {
    if (!confirm('Delete this artifact?')) return
    try {
      await artifactsService.delete(clientId, processId, artifactId)
      toast.success('Artifact deleted')
      mutateArtifacts()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Artifacts
        </CardTitle>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Select
              value={uploadStage}
              onValueChange={(v: string | null) => v && setUploadStage(v as ArtifactStage)}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="input">Input</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="output">Output</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : artifacts.length === 0 ? (
          <div className="text-sm text-muted-foreground">No artifacts uploaded yet.</div>
        ) : (
          <div className="space-y-2">
            {artifacts.map((artifact: Artifact) => (
              <div
                key={artifact.id}
                className="flex items-center justify-between py-2 px-3 rounded-md border text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{artifact.filename}</span>
                  {artifact.stage && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {artifact.stage}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatBytes(artifact.fileSizeBytes)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(artifact.id)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => handleDelete(artifact.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
