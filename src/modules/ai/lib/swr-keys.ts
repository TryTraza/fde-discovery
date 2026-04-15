export const SKILL_KEYS = {
  list: () => '/api/settings/skills',
}

export const AI_AGENT_KEYS = {
  list: () => '/api/settings/ai-agents',
  registries: () => '/api/settings/registries',
}

export const SKILL_MATCH = {
  any: (key: unknown) => typeof key === 'string' && key.startsWith('/api/settings/skills'),
}

export const AI_AGENT_MATCH = {
  any: (key: unknown) => typeof key === 'string' && key.startsWith('/api/settings/ai-agents'),
}
