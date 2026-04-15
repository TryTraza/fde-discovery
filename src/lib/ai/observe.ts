import { Langfuse } from 'langfuse'

let instance: Langfuse | null | undefined // undefined = not yet initialized

export function getLangfuseClient(): Langfuse | null {
  if (instance !== undefined) return instance

  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY

  if (!secretKey || !publicKey) {
    console.info('[AI] Langfuse not configured — observability disabled.')
    instance = null
    return null
  }

  try {
    instance = new Langfuse({
      secretKey,
      publicKey,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    })
    return instance
  } catch (err) {
    console.warn('[AI] Langfuse initialization failed:', err)
    instance = null
    return null
  }
}
