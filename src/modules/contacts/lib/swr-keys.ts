export const CONTACT_KEYS = {
  listForClient: (clientId: string) => `/api/clients/${clientId}/contacts`,
}

export const CONTACT_MATCH = {
  listForClient: (clientId: string) => (key: unknown) =>
    typeof key === 'string' && key === `/api/clients/${clientId}/contacts`,
}
