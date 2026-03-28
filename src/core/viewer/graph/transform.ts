import type { Screen, Setup, Workflow } from '../../schema.js';

export interface SpecsInput {
  screens: Screen[];
  setups: Setup[];
  workflows: Workflow[];
}

type NodeType = 'screen' | 'setup';
type EdgeType = 'navigates_to' | 'workflow' | 'given';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sublabel: string;
  metadata: {
    caseCount?: number;
    stepCount?: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function specsToGraph(data: SpecsInput): GraphData {
  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();

  for (const s of data.screens) {
    const id = `screen:${s.screen}`;
    nodes.push({
      id,
      type: 'screen',
      label: s.title,
      sublabel: s.route,
      metadata: { caseCount: s.cases.length },
    });
    nodeIds.add(id);
  }

  for (const s of data.setups) {
    const id = `setup:${s.setup}`;
    nodes.push({
      id,
      type: 'setup',
      label: s.title,
      sublabel: s.setup,
      metadata: { stepCount: s.steps.length },
    });
    nodeIds.add(id);
  }

  const edgeMap = new Map<string, GraphEdge>();

  for (const s of data.screens) {
    const sourceId = `screen:${s.screen}`;

    for (const c of s.cases) {
      if (c.navigates_to) {
        const targetId = `screen:${c.navigates_to}`;
        if (!nodeIds.has(targetId)) continue;

        const key = `${sourceId}|${targetId}|navigates_to`;
        const existing = edgeMap.get(key);
        if (existing) {
          existing.label = existing.label ? `${existing.label}, ${c.action}` : c.action;
        } else {
          edgeMap.set(key, {
            id: key,
            source: sourceId,
            target: targetId,
            type: 'navigates_to',
            label: c.action,
          });
        }
      }

      const givens = c.given ? (Array.isArray(c.given) ? c.given : [c.given]) : [];
      for (const g of givens) {
        const targetId = `setup:${g}`;
        if (!nodeIds.has(targetId)) continue;

        const key = `${sourceId}|${targetId}|given`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, {
            id: key,
            source: sourceId,
            target: targetId,
            type: 'given',
          });
        }
      }
    }
  }

  for (const w of data.workflows) {
    for (let i = 0; i < w.steps.length - 1; i++) {
      const sourceId = `screen:${w.steps[i].screen}`;
      const targetId = `screen:${w.steps[i + 1].screen}`;
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) continue;

      const key = `${sourceId}|${targetId}|workflow`;
      const label = `${w.workflow} #${i + 1}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.label = existing.label ? `${existing.label}, ${label}` : label;
      } else {
        edgeMap.set(key, {
          id: key,
          source: sourceId,
          target: targetId,
          type: 'workflow',
          label,
        });
      }
    }
  }

  return { nodes, edges: [...edgeMap.values()] };
}
