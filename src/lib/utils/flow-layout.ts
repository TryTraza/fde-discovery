import { Graph, layout } from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { ProcessStepParsed } from '@/lib/validations/process';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 80;
const TERMINAL_SIZE = 48;

export function layoutProcessSteps(steps: ProcessStepParsed[]): {
  nodes: Node[];
  edges: Edge[];
} {
  const g = new Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 50, nodesep: 40 });

  // Terminal nodes
  g.setNode('start', { width: TERMINAL_SIZE, height: TERMINAL_SIZE });
  g.setNode('end', { width: TERMINAL_SIZE, height: TERMINAL_SIZE });

  // Step nodes
  for (const step of steps) {
    g.setNode(step.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Edges: start → step1 → step2 → ... → stepN → end
  if (steps.length > 0) {
    g.setEdge('start', steps[0].id);
    for (let i = 0; i < steps.length - 1; i++) {
      g.setEdge(steps[i].id, steps[i + 1].id);
    }
    g.setEdge(steps[steps.length - 1].id, 'end');
  } else {
    g.setEdge('start', 'end');
  }

  layout(g);

  const nodes: Node[] = [
    {
      id: 'start',
      type: 'terminal',
      position: centered(g.node('start'), TERMINAL_SIZE, TERMINAL_SIZE),
      data: { label: 'Start' },
    },
    ...steps.map((step, index) => ({
      id: step.id,
      type: 'processStep' as const,
      position: centered(g.node(step.id), NODE_WIDTH, NODE_HEIGHT),
      data: { step, index },
    })),
    {
      id: 'end',
      type: 'terminal',
      position: centered(g.node('end'), TERMINAL_SIZE, TERMINAL_SIZE),
      data: { label: 'End' },
    },
  ];

  const edges: Edge[] = [];
  if (steps.length > 0) {
    edges.push({
      id: 'e-start-first',
      source: 'start',
      target: steps[0].id,
      type: 'smoothstep',
      animated: false,
    });
    for (let i = 0; i < steps.length - 1; i++) {
      edges.push({
        id: `e-${steps[i].id}-${steps[i + 1].id}`,
        source: steps[i].id,
        target: steps[i + 1].id,
        type: 'smoothstep',
        animated: false,
      });
    }
    edges.push({
      id: 'e-last-end',
      source: steps[steps.length - 1].id,
      target: 'end',
      type: 'smoothstep',
      animated: false,
    });
  } else {
    edges.push({
      id: 'e-start-end',
      source: 'start',
      target: 'end',
      type: 'smoothstep',
      animated: false,
    });
  }

  return { nodes, edges };
}

function centered(
  dagreNode: { x: number; y: number },
  width: number,
  height: number
) {
  return {
    x: dagreNode.x - width / 2,
    y: dagreNode.y - height / 2,
  };
}
