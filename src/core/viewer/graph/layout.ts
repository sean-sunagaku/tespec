import dagre from '@dagrejs/dagre';

import type { GraphData, GraphEdge, GraphNode } from './transform.js';

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedEdge extends GraphEdge {
  points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_RANK_SEP = 80;
const DEFAULT_NODE_SEP = 40;

export function computeLayout(data: GraphData, options?: LayoutOptions): LayoutResult {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: options?.direction ?? 'TB',
    ranksep: options?.rankSep ?? DEFAULT_RANK_SEP,
    nodesep: options?.nodeSep ?? DEFAULT_NODE_SEP,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = options?.nodeWidth ?? DEFAULT_NODE_WIDTH;
  const nodeHeight = options?.nodeHeight ?? DEFAULT_NODE_HEIGHT;

  for (const node of data.nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of data.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const positionedNodes: PositionedNode[] = [];
  let maxX = 0;
  let maxY = 0;

  for (const id of g.nodes()) {
    const layout = g.node(id);
    const original = nodeMap.get(id);
    if (!layout || !original) continue;

    positionedNodes.push({
      ...original,
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    });

    const right = layout.x + layout.width / 2;
    const bottom = layout.y + layout.height / 2;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  const positionedEdges: PositionedEdge[] = data.edges
    .filter((edge) => g.hasNode(edge.source) && g.hasNode(edge.target))
    .map((edge) => {
      const dagreEdge = g.edge(edge.source, edge.target);
      return {
        ...edge,
        points: dagreEdge?.points ?? [],
      };
    });

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    width: maxX,
    height: maxY,
  };
}
