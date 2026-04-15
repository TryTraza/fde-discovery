import { getSkillsBySlugs } from '@/lib/db/queries/skills';
import { EMPTY_SKILLS, type ResolvedSkills } from '@/lib/ai/types';

export async function resolveSkills(slugs: string[]): Promise<ResolvedSkills> {
  if (slugs.length === 0) return EMPTY_SKILLS;

  const skills = await getSkillsBySlugs(slugs);
  if (skills.length === 0) return EMPTY_SKILLS;

  const systemPromptFragments: string[] = [];
  const contextEnrichments: Record<string, string> = {};
  const instructions: string[] = [];

  for (const skill of skills) {
    switch (skill.type) {
      case 'system-prompt':
        systemPromptFragments.push(skill.content);
        break;

      case 'instruction':
        instructions.push(skill.content);
        break;

      case 'context-enrichment':
        for (const line of skill.content.split('\n')) {
          const eqIndex = line.indexOf('=');
          if (eqIndex === -1) {
            console.warn(`[AI] Skill "${skill.slug}": malformed context-enrichment line (no '='): "${line}"`);
            continue;
          }
          const key = line.slice(0, eqIndex).trim();
          const value = line.slice(eqIndex + 1).trim();
          if (key) contextEnrichments[key] = value;
        }
        break;
    }
  }

  return { systemPromptFragments, contextEnrichments, instructions };
}
