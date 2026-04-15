export const SESSION_KEYS = {
  listForProcess: (processId: string) => `/api/sessions?processId=${processId}`,
  detail: (sessionId: string) => `/api/sessions/${sessionId}`,
  events: (sessionId: string) => `/api/sessions/${sessionId}/events`,
}

export const SESSION_MATCH = {
  detail: (sessionId: string) => (key: unknown) =>
    typeof key === 'string' && key === `/api/sessions/${sessionId}`,
  allRelated: (key: unknown) => typeof key === 'string' && key.startsWith('/api/sessions'),
}
