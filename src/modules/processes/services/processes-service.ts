import { apiClient } from '@/lib/api-client'

export interface ProcessSummary {
  id: string
  name: string
  status: string
  departmentTag?: string | null
  description?: string | null
  processTypeL1?: string | null
  hypothesisText?: string | null
  [key: string]: unknown
}

export interface ProcessCreateInput {
  name: string
  description?: string
  departmentTag?: string
  knownSystems?: string[]
  knownPainPoints?: string
  processTypeL1?: string
}

export type ProcessUpdateInput = Partial<{
  name: string | null
  description: string | null
  departmentTag: string | null
  status: string
  processTypeL1: string | null
  hypothesisText: string | null
}>

function basePath(clientId: string): string {
  return `/api/clients/${clientId}/processes`
}

class ProcessesService {
  async list(clientId: string): Promise<ProcessSummary[]> {
    return apiClient.get<ProcessSummary[]>(basePath(clientId))
  }

  async getById(clientId: string, processId: string): Promise<ProcessSummary> {
    return apiClient.get<ProcessSummary>(`${basePath(clientId)}/${processId}`)
  }

  async create(clientId: string, data: ProcessCreateInput): Promise<ProcessSummary> {
    return apiClient.post<ProcessSummary>(basePath(clientId), data)
  }

  async update(
    clientId: string,
    processId: string,
    data: ProcessUpdateInput
  ): Promise<ProcessSummary> {
    return apiClient.patch<ProcessSummary>(`${basePath(clientId)}/${processId}`, data)
  }

  async delete(clientId: string, processId: string): Promise<void> {
    await apiClient.delete(`${basePath(clientId)}/${processId}`)
  }

  async regenerateHypothesis(clientId: string, processId: string): Promise<unknown> {
    return apiClient.post(`${basePath(clientId)}/${processId}/hypothesis`)
  }

  async updateSteps(
    clientId: string,
    processId: string,
    steps: unknown[]
  ): Promise<unknown> {
    return apiClient.patch(`${basePath(clientId)}/${processId}/steps`, { steps })
  }
}

export const processesService = new ProcessesService()
