import { apiClient } from '@/lib/api-client'

export interface Artifact {
  id: string
  clientId: string
  processId: string
  filename: string
  stage: 'input' | 'intermediate' | 'output' | 'reference' | string
  fileSizeBytes: number
  storagePath: string
  createdAt: string
}

export type ArtifactStage = 'input' | 'intermediate' | 'output' | 'reference'

function basePath(clientId: string, processId: string): string {
  return `/api/clients/${clientId}/processes/${processId}/artifacts`
}

class ArtifactsService {
  async list(clientId: string, processId: string): Promise<Artifact[]> {
    return apiClient.get<Artifact[]>(basePath(clientId, processId))
  }

  async getDownloadUrl(
    clientId: string,
    processId: string,
    artifactId: string
  ): Promise<{ downloadUrl: string }> {
    return apiClient.get<{ downloadUrl: string }>(
      `${basePath(clientId, processId)}/${artifactId}`
    )
  }

  async delete(clientId: string, processId: string, artifactId: string): Promise<void> {
    await apiClient.delete(`${basePath(clientId, processId)}/${artifactId}`)
  }

  /**
   * Upload uses multipart/form-data, which the JSON-only `apiClient` doesn't
   * handle. We call `fetch` directly here and mirror the error-mapping shape
   * (server `error` field surfaces as the thrown Error message).
   */
  async upload(
    clientId: string,
    processId: string,
    file: File,
    stage: ArtifactStage
  ): Promise<Artifact> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('stage', stage)

    const res = await fetch(basePath(clientId, processId), {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const message =
        (body as { error?: string }).error || res.statusText || 'Upload failed'
      throw new Error(message)
    }

    return res.json() as Promise<Artifact>
  }
}

export const artifactsService = new ArtifactsService()
