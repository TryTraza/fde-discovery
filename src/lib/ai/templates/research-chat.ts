import { renderTemplate } from './render'

export interface ResearchChatTemplateInput {
  clientSection: string
  processSection: string
}

/**
 * Renders the per-conversation context block for the research-chat
 * worker. This is prepended to the static persona systemPrompt at the
 * route layer (system = persona + "\n\n" + this).
 *
 * For SSE chats the system prompt has to carry per-call context up
 * front because the user messages are the actual conversation. The
 * persona half stays static and ports cleanly to a Traza worker; this
 * template covers the caller-supplied half.
 */
export function renderResearchChatContext(input: ResearchChatTemplateInput): string {
  const sections = renderTemplate([
    {
      when: !!input.clientSection.trim(),
      body: input.clientSection,
    },
    {
      when: !!input.processSection.trim(),
      body: input.processSection,
    },
  ])
  if (!sections) return ''
  return `## Current context\n\n${sections}`
}
