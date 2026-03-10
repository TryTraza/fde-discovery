// ====================================================================
// ProcessModel JSONB types (stored in processModels.steps/edgeCases/systems)
// ====================================================================

export interface ProcessStep {
  id: string;                      // e.g. "step_001"
  order: number;                   // 1, 2, 3...
  name: string;                    // "Open supplier email" (3-8 words)
  description: string;             // One sentence
  confidence: 'confirmed' | 'inferred' | 'missing';
  sourceSessionId?: string;        // Which session confirmed/created this
  systems: string[];               // ["Email", "Excel"]
  nextSteps: string[];             // ["step_002"] — multiple = branch
  branchCondition?: string | null; // "Price present?" — only if nextSteps.length > 1
  relatedEdgeCases: string[];      // ["edge_001"]
  notes: string;                   // Free text
}

export interface EdgeCase {
  id: string;                      // e.g. "edge_001"
  description: string;             // "Supplier responds without price"
  frequency: 'rare' | 'occasional' | 'frequent' | 'unknown';
  suggestedHandling: string;       // "Flag for manual review"
  status: 'open' | 'needs_clarification' | 'resolved';
  sourceSessionId?: string;
  relatedStepId?: string;          // Which step this edge case applies to
}

export interface SystemEntry {
  name: string;                    // "Excel", "SharePoint", "SAP"
  confirmed: boolean;              // true if directly observed
  role: string;                    // "Document storage for proformas"
  details: string;                 // "/Proformas/Pending folder"
  gaps: string;                    // "Unknown: who has write access?"
  detailNotes: string;             // FREE TEXT for column mappings, sheet names, etc.
  sourceSessionId?: string;
}

// ====================================================================
// Session JSONB types
// ====================================================================

export interface InterviewAnswers {
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

export interface PrepBrief {
  whatWeKnow: string;              // Markdown
  whatsOpen: string;               // Markdown
  suggestedFocus: string[];        // 5-10 actionable items
}

export interface ShadowingConfig {
  personShadowedContactId: string;
  focusArea: 'full_flow' | 'specific_steps' | 'edge_cases_only';
  gapsToFill: string[];            // Open question IDs to focus on
}

export interface ValidationConfig {
  stepsToValidate: string[];       // ProcessStep IDs
}

export interface DemoConfig {
  scenarios: string;               // Free text
  knownEdgeCases: string;          // Free text
}

export interface DebriefItem {
  eventLogId: string;
  type: 'question' | 'implicit';
  resolution: 'asked_answered' | 'described' | 'open_question' | 'skipped';
  answer?: string;                 // For asked_answered
  description?: string;            // For described (implicit)
  priority?: 'critical' | 'important' | 'nice_to_have';  // For open_question
  openQuestionCreated: boolean;
  openQuestionId?: string;
}

export interface DebriefAnswers {
  items: DebriefItem[];
}

export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
}
