import { z } from 'zod';

export const prepQuestionSchema = z.object({
  question: z.string().describe('A refined, specific question to ask during the session'),
  rationale: z.string().describe('Why this question matters and what insight it should uncover'),
  followUp: z.string().describe('A follow-up question if the initial answer is vague or incomplete'),
});

export const prepApproachSchema = z.object({
  title: z.string().describe('Short name for the approach or tactic'),
  description: z.string().describe('How to apply this approach during the session'),
});

export const prepBriefSchema = z.object({
  summary: z.string().describe('2-3 sentence overview of what this session should accomplish based on the FDE goals and process context'),
  questionsToAsk: z.array(prepQuestionSchema).describe('5-8 refined questions to ask during the session, ordered by priority'),
  approaches: z.array(prepApproachSchema).describe('2-4 tactical approaches or techniques for this session'),
  areasToProbe: z.array(z.string()).describe('3-5 specific areas where the FDE should push for deeper answers or evidence'),
  watchFor: z.array(z.string()).describe('2-3 red flags or signals to watch for during the session'),
});

export type PrepBrief = z.infer<typeof prepBriefSchema>;
export type PrepQuestion = z.infer<typeof prepQuestionSchema>;
