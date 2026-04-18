export const SESSION_KEYS = {
  listForClient: (clientId: string, processId?: string) => {
    const base = `/api/sessions?clientId=${clientId}`
    return processId ? `${base}&processId=${processId}` : base
  },
  detail: (sessionId: string) => `/api/sessions/${sessionId}`,
  events: (sessionId: string) => `/api/sessions/${sessionId}/events`,
}

export const SESSION_MATCH = {
  detail: (sessionId: string) => (key: unknown) =>
    typeof key === 'string' && key === `/api/sessions/${sessionId}`,
  allRelated: (key: unknown) => typeof key === 'string' && key.startsWith('/api/sessions'),
}
