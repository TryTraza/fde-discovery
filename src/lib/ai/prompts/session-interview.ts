import { getSessionTypeLabel } from '@/lib/utils/session-labels'

export function buildInterviewPrompt(params: {
  client: { name: string; industry: string; website: string | null; aiSummary: string | null }
  processContext: {
    name: string
    description: string | null
    hypothesisText: string | null
    model: any | null
    departmentTag: string | null
  }
  sessionType: string
  sessionContacts: Array<{ name: string; role: string | null; department: string | null }>
  previousAnswers: { question: string; answer: string }[]
  questionIndex: number
}): string {
  const { client, processContext, sessionType, sessionContacts, previousAnswers, questionIndex } =
    params
  const typeLabel = getSessionTypeLabel(sessionType)

  const modelContext = processContext.model
    ? `Current process model steps: ${JSON.stringify(processContext.model.steps ?? [])}`
    : 'No process model exists yet.'

  const previousContext =
    previousAnswers.length > 0
      ? `Previous Q&A:\n${previousAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}`
      : 'First question.'

  const contactsContext =
    sessionContacts.length > 0
      ? `Known contacts for this session:\n${sessionContacts.map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ''}${c.department ? `, ${c.department}` : ''}`).join('\n')}`
      : 'No contacts assigned to this session yet.'

  return `You are gathering context from an FDE (Field Discovery Engineer) who is about to create a "${typeLabel}" session for the process "${processContext.name}".

Company: ${client.name}
Industry: ${client.industry}
${client.website ? `Website: ${client.website}` : ''}
${client.aiSummary ? `Company research: ${client.aiSummary}` : ''}

Process: ${processContext.name}
${processContext.description ? `Description: ${processContext.description}` : ''}
${processContext.departmentTag ? `Department: ${processContext.departmentTag}` : ''}
Hypothesis: ${processContext.hypothesisText ?? 'None'}
${modelContext}

${contactsContext}

Your goal is to understand what the FDE wants to achieve in this session so you can later generate a tailored prep brief with refined questions, approaches, and focus areas.

${previousContext}

Generate question ${questionIndex + 1} of 3. Build on previous answers. Ask about:
- Question 1: What are the main goals or objectives of this session? What specific aspects of the process do you want to uncover or validate?
- Question 2: Who will you be meeting with (their role, influence), and what is their likely perspective or knowledge of the process?
- Question 3: Are there any known blockers, sensitive topics, or specific pain points you want to dig into?

Adapt the exact wording based on the session type, process context, company industry, and previous answers. Don't ask literally the template above — use it as guidance to craft a natural, context-aware question. Be conversational and specific to this process and company.`
}
