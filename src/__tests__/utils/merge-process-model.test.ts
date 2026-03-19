import { describe, it, expect, vi } from 'vitest';
import { mergeSteps, mergeEdgeCases, mergeSystems } from '@/lib/utils/merge-process-model';
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis';

// --- mergeSteps ---

describe('mergeSteps', () => {
  const existingSteps = [
    { id: 'step-1', name: 'Login', description: 'User logs in', order: 0, confidence: 'confirmed', systems: ['SSO'], next_steps: ['step-2'], branch_condition: null, related_edge_cases: [], notes: 'existing note' },
    { id: 'step-2', name: 'Dashboard', description: 'See dashboard', order: 1, confidence: 'confirmed', systems: [], next_steps: [], branch_condition: null, related_edge_cases: [], notes: '' },
  ];

  it('adds new step with UUID', () => {
    const synthesis: SynthesisOutput['steps'] = [
      { stepId: null, name: 'Logout', description: 'User logs out', order: 2, confidence: 'confirmed', systems: ['SSO'], changeType: 'new' },
    ];
    const result = mergeSteps(existingSteps, synthesis);
    expect(result).toHaveLength(3);
    const newStep = result.find(s => s.name === 'Logout');
    expect(newStep).toBeDefined();
    expect(newStep!.id).toBeDefined();
    expect(newStep!.id).not.toBe('step-1');
    expect(newStep!.id).not.toBe('step-2');
    expect(newStep!.description).toBe('User logs out');
  });

  it('modifies existing by stepId and preserves extra fields', () => {
    const synthesis: SynthesisOutput['steps'] = [
      { stepId: 'step-1', name: 'Login v2', description: 'Updated login', order: 0, confidence: 'inferred', systems: ['SSO', 'MFA'], changeType: 'modified' },
    ];
    const result = mergeSteps(existingSteps, synthesis);
    const modified = result.find(s => s.id === 'step-1');
    expect(modified!.name).toBe('Login v2');
    expect(modified!.description).toBe('Updated login');
    expect(modified!.confidence).toBe('inferred');
    expect(modified!.systems).toEqual(['SSO', 'MFA']);
    // Preserved extra fields
    expect(modified!.next_steps).toEqual(['step-2']);
    expect(modified!.notes).toBe('existing note');
  });

  it('removes existing by stepId', () => {
    const synthesis: SynthesisOutput['steps'] = [
      { stepId: 'step-2', name: 'Dashboard', description: 'See dashboard', order: 1, confidence: 'confirmed', systems: [], changeType: 'removed' },
    ];
    const result = mergeSteps(existingSteps, synthesis);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('step-1');
  });

  it('skips invalid stepId for modified', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const synthesis: SynthesisOutput['steps'] = [
      { stepId: 'nonexistent', name: 'Ghost', description: 'Not real', order: 5, confidence: 'inferred', systems: [], changeType: 'modified' },
    ];
    const result = mergeSteps(existingSteps, synthesis);
    expect(result).toHaveLength(2); // unchanged
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    warnSpy.mockRestore();
  });

  it('skips invalid stepId for removed', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const synthesis: SynthesisOutput['steps'] = [
      { stepId: 'nonexistent', name: 'Ghost', description: 'Not real', order: 5, confidence: 'confirmed', systems: [], changeType: 'removed' },
    ];
    const result = mergeSteps(existingSteps, synthesis);
    expect(result).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    warnSpy.mockRestore();
  });

  it('re-normalizes order to sequential integers', () => {
    const synthesis: SynthesisOutput['steps'] = [
      { stepId: null, name: 'Middle', description: 'Inserted', order: 1, confidence: 'confirmed', systems: [], changeType: 'new' },
    ];
    const result = mergeSteps(existingSteps, synthesis);
    expect(result.map(s => s.order)).toEqual([0, 1, 2]);
  });

  it('leaves unchanged untouched', () => {
    const synthesis: SynthesisOutput['steps'] = [
      { stepId: 'step-1', name: 'Login', description: 'User logs in', order: 0, confidence: 'confirmed', systems: ['SSO'], changeType: 'unchanged' },
    ];
    const result = mergeSteps(existingSteps, synthesis);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ...existingSteps[0], order: 0 });
  });

  it('handles empty current + new steps', () => {
    const synthesis: SynthesisOutput['steps'] = [
      { stepId: null, name: 'First', description: 'Brand new', order: 0, confidence: 'confirmed', systems: [], changeType: 'new' },
    ];
    const result = mergeSteps([], synthesis);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('First');
    expect(result[0].order).toBe(0);
    expect(result[0].id).toBeDefined();
  });
});

// --- mergeEdgeCases ---

describe('mergeEdgeCases', () => {
  const existingEdgeCases = [
    { id: 'ec-1', description: 'Timeout', frequency: 'rare', suggestedHandling: 'Retry', status: 'resolved', related_step_id: 'step-1' },
  ];

  it('adds new with status open', () => {
    const synthesis: SynthesisOutput['edgeCases'] = [
      { edgeCaseId: null, description: 'Network error', frequency: 'occasional', suggestedHandling: 'Show error', changeType: 'new' },
    ];
    const result = mergeEdgeCases(existingEdgeCases, synthesis);
    expect(result).toHaveLength(2);
    const newEc = result.find(e => e.description === 'Network error');
    expect(newEc!.status).toBe('open');
    expect(newEc!.related_step_id).toBeNull();
    expect(newEc!.id).toBeDefined();
  });

  it('modifies existing and preserves status + related_step_id', () => {
    const synthesis: SynthesisOutput['edgeCases'] = [
      { edgeCaseId: 'ec-1', description: 'Timeout v2', frequency: 'frequent', suggestedHandling: 'Auto-retry', changeType: 'modified' },
    ];
    const result = mergeEdgeCases(existingEdgeCases, synthesis);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Timeout v2');
    expect(result[0].frequency).toBe('frequent');
    // Preserved
    expect(result[0].status).toBe('resolved');
    expect(result[0].related_step_id).toBe('step-1');
  });

  it('skips invalid edgeCaseId', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const synthesis: SynthesisOutput['edgeCases'] = [
      { edgeCaseId: 'nonexistent', description: 'Ghost', frequency: 'rare', suggestedHandling: 'Skip', changeType: 'modified' },
    ];
    const result = mergeEdgeCases(existingEdgeCases, synthesis);
    expect(result).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    warnSpy.mockRestore();
  });
});

// --- mergeSystems ---

describe('mergeSystems', () => {
  const existingSystems = [
    { id: 'sys-1', name: 'SAP', confirmed: true, role: 'ERP', details: 'Main ERP', gaps: '' },
  ];

  it('adds new system (not duplicate)', () => {
    const synthesis: SynthesisOutput['systems'] = [
      { name: 'Salesforce', confirmed: false, role: 'CRM', details: 'Customer mgmt', gaps: 'Access needed', changeType: 'new' },
    ];
    const result = mergeSystems(existingSystems, synthesis);
    expect(result).toHaveLength(2);
    const newSys = result.find(s => s.name === 'Salesforce');
    expect(newSys!.confirmed).toBe(false);
    expect(newSys!.role).toBe('CRM');
    expect(newSys!.id).toBeDefined();
  });

  it('modifies by name (case-insensitive)', () => {
    const synthesis: SynthesisOutput['systems'] = [
      { name: 'sap', confirmed: true, role: 'ERP v2', details: 'Updated details', gaps: 'New gap', changeType: 'modified' },
    ];
    const result = mergeSystems(existingSystems, synthesis);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('ERP v2');
    expect(result[0].details).toBe('Updated details');
    expect(result[0].gaps).toBe('New gap');
    // Preserved id
    expect(result[0].id).toBe('sys-1');
  });

  it('does NOT add duplicate name', () => {
    const synthesis: SynthesisOutput['systems'] = [
      { name: 'SAP', confirmed: true, role: 'ERP', details: 'Same', changeType: 'new' },
    ];
    const result = mergeSystems(existingSystems, synthesis);
    expect(result).toHaveLength(1);
  });
});
