export const PROCESS_KEYS = {
  list: (clientId: string) => `/api/clients/${clientId}/processes`,
  detail: (clientId: string, processId: string) =>
    `/api/clients/${clientId}/processes/${processId}`,
}

export const PROCESS_MATCH = {
  allRelated: (clientId: string) => (key: unknown) =>
    typeof key === 'string' && key.startsWith(`/api/clients/${clientId}/processes`),
}
