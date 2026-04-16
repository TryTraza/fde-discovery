/**
 * renderTemplate — tiny, dependency-free helper for building user prompts.
 *
 * A template is an ordered list of sections. Each section is either always
 * rendered, or conditionally (`when: boolean`). Empty bodies are skipped
 * automatically so callers can write `when: !!value` without trimming.
 *
 * Deterministic and pure — same input, same output. Makes snapshot tests easy.
 *
 * The output mirrors what Langfuse {{var}} compilation produced: a single
 * string the model reads as the user prompt. This is the shape that the
 * AIGateway will eventually ship to a Traza worker unchanged.
 */

export interface TemplateSection {
  /** If set to `false` the section is skipped entirely. Default: `true`. */
  when?: boolean
  /** Optional heading rendered as a markdown H2 (`## <heading>`). */
  heading?: string
  /** Section body. A function form lets you defer expensive string work. */
  body: string | (() => string)
}

const SECTION_SEPARATOR = '\n\n'

export function renderTemplate(sections: TemplateSection[]): string {
  const out: string[] = []

  for (const section of sections) {
    if (section.when === false) continue

    const raw = typeof section.body === 'function' ? section.body() : section.body
    const body = raw.trim()
    if (!body) continue

    if (section.heading) {
      out.push(`## ${section.heading}\n${body}`)
    } else {
      out.push(body)
    }
  }

  return out.join(SECTION_SEPARATOR)
}
