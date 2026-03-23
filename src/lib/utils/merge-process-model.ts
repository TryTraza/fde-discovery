import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis';

export function mergeSteps(
  current: any[],
  synthesisSteps: SynthesisOutput['steps']
): any[] {
  const result = [...current];

  for (const s of synthesisSteps) {
    switch (s.changeType) {
      case 'new':
        result.push({
          id: crypto.randomUUID(),
          name: s.name,
          description: s.description,
          order: s.order,
          confidence: s.confidence,
          systems: s.systems,
          next_steps: [],
          branch_condition: null,
          related_edge_cases: [],
          notes: '',
        });
        break;

      case 'modified':
        if (s.stepId) {
          const idx = result.findIndex(r => r.id === s.stepId);
          if (idx !== -1) {
            result[idx] = {
              ...result[idx],
              name: s.name,
              description: s.description,
              order: s.order,
              confidence: s.confidence,
              systems: s.systems,
            };
          } else {
            console.warn(`Unknown stepId: ${s.stepId} — skipping`);
          }
        }
        break;

      case 'removed':
        if (s.stepId) {
          const idx = result.findIndex(r => r.id === s.stepId);
          if (idx !== -1) result.splice(idx, 1);
          else console.warn(`Unknown stepId for removal: ${s.stepId} — skipping`);
        }
        break;
      // 'unchanged': skip
    }
  }

  return result
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((step, i) => ({ ...step, order: i }));
}

export function mergeEdgeCases(
  current: any[],
  synthesisEdgeCases: SynthesisOutput['edgeCases']
): any[] {
  const result = [...current];

  for (const ec of synthesisEdgeCases) {
    switch (ec.changeType) {
      case 'new':
        result.push({
          id: crypto.randomUUID(),
          description: ec.description,
          frequency: ec.frequency,
          suggestedHandling: ec.suggestedHandling,
          status: 'open',
          related_step_id: null,
        });
        break;

      case 'modified':
        if (ec.edgeCaseId) {
          const idx = result.findIndex(r => r.id === ec.edgeCaseId);
          if (idx !== -1) {
            result[idx] = {
              ...result[idx],
              description: ec.description,
              frequency: ec.frequency,
              suggestedHandling: ec.suggestedHandling,
            };
          } else {
            console.warn(`Unknown edgeCaseId: ${ec.edgeCaseId} — skipping`);
          }
        }
        break;
      // 'unchanged': skip
    }
  }
  return result;
}

export function mergeSystems(
  current: any[],
  synthesisSystems: SynthesisOutput['systems']
): any[] {
  const result = [...current];

  for (const sys of synthesisSystems) {
    switch (sys.changeType) {
      case 'new': {
        const exists = result.some(r => r.name.toLowerCase() === sys.name.toLowerCase());
        if (!exists) {
          result.push({
            id: crypto.randomUUID(),
            name: sys.name,
            confirmed: sys.confirmed,
            role: sys.role,
            details: sys.details,
            gaps: sys.gaps ?? '',
            detailNotes: sys.detailNotes ?? '',
          });
        }
        break;
      }

      case 'modified': {
        const idx = result.findIndex(r => r.name.toLowerCase() === sys.name.toLowerCase());
        if (idx !== -1) {
          result[idx] = {
            ...result[idx],
            confirmed: sys.confirmed,
            role: sys.role,
            details: sys.details,
            gaps: sys.gaps ?? result[idx].gaps ?? '',
            detailNotes: [result[idx].detailNotes, sys.detailNotes]
              .filter(Boolean)
              .join('\n---\n') || '',
          };
        }
        break;
      }
      // 'unchanged': skip
    }
  }
  return result;
}
