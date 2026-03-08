import 'server-only';
import { createAnthropic } from '@ai-sdk/anthropic';

export function createUserAnthropic(apiKey: string) {
  return createAnthropic({ apiKey });
}
