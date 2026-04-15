export const ARTIFACT_KEYS = {
  list: (clientId: string, processId: string) =>
    `/api/clients/${clientId}/processes/${processId}/artifacts`,
}
