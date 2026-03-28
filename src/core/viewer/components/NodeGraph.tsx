import { useMemo, useRef, useState } from 'preact/hooks';
import type { PositionedEdge, PositionedNode } from '../graph/layout.js';
import { computeLayout } from '../graph/layout.js';
import { type SpecsInput, specsToGraph } from '../graph/transform.js';

interface NodeGraphProps {
  data: SpecsInput;
  onNodeClick: (type: 'screen' | 'setup', id: string) => void;
}

interface TooltipState {
  node: PositionedNode;
  x: number;
  y: number;
}

const EDGE_STYLES: Record<string, { stroke: string; dasharray?: string }> = {
  navigates_to: { stroke: '#3B82F6' },
  workflow: { stroke: '#8B5CF6', dasharray: '6 3' },
  given: { stroke: '#10B981', dasharray: '3 3' },
};

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  screen: { fill: '#EFF6FF', stroke: '#3B82F6' },
  setup: { fill: '#ECFDF5', stroke: '#10B981' },
};

export function NodeGraph({ data, onNodeClick }: NodeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const layout = useMemo(() => {
    const graphData = specsToGraph(data);
    return computeLayout(graphData);
  }, [data]);

  if (layout.nodes.length === 0) {
    return (
      <div
        data-testid="node-graph-empty"
        class="flex items-center justify-center h-full text-gray-400"
      >
        No graph data
      </div>
    );
  }

  const padding = 40;
  const viewWidth = layout.width + padding * 2;
  const viewHeight = layout.height + padding * 2;

  function handleNodeClick(node: PositionedNode) {
    const [type, ...idParts] = node.id.split(':');
    const id = idParts.join(':');
    onNodeClick(type as 'screen' | 'setup', id);
  }

  function handleMouseEnter(node: PositionedNode, e: MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setTooltip({
      node,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        data-testid="node-graph"
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        style={{ overflow: 'hidden' }}
      >
        <g transform={`translate(${padding}, ${padding})`}>
          {layout.edges.map((edge) => (
            <EdgeComponent key={edge.id} edge={edge} />
          ))}
          {layout.nodes.map((node) => (
            <NodeComponent
              key={node.id}
              node={node}
              onClick={() => handleNodeClick(node)}
              onMouseEnter={(e: MouseEvent) => handleMouseEnter(node, e)}
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </g>
      </svg>
      {tooltip && (
        <div
          data-testid="graph-tooltip"
          style={{
            position: 'absolute',
            left: `${tooltip.x + 12}px`,
            top: `${tooltip.y - 8}px`,
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600 }}>{tooltip.node.label}</div>
          <div style={{ color: '#6B7280' }}>{tooltip.node.sublabel}</div>
          {tooltip.node.metadata.caseCount != null && (
            <div style={{ color: '#9CA3AF', marginTop: '2px' }}>
              {tooltip.node.metadata.caseCount} cases
            </div>
          )}
          {tooltip.node.metadata.stepCount != null && (
            <div style={{ color: '#9CA3AF', marginTop: '2px' }}>
              {tooltip.node.metadata.stepCount} steps
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NodeComponent({
  node,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  node: PositionedNode;
  onClick: () => void;
  onMouseEnter: (e: MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  const colors = NODE_COLORS[node.type] ?? NODE_COLORS.screen;
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG elements cannot use <button>
    <g
      role="button"
      tabIndex={0}
      data-testid={`graph-node-${node.id}`}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <rect
        x={x}
        y={y}
        width={node.width}
        height={node.height}
        rx={8}
        fill={colors.fill}
        stroke={colors.stroke}
        stroke-width={1.5}
      />
      <text
        x={node.x}
        y={node.y - 4}
        text-anchor="middle"
        font-size={12}
        font-weight={600}
        fill="#1F2937"
      >
        {node.label.length > 16 ? `${node.label.slice(0, 15)}...` : node.label}
      </text>
      <text x={node.x} y={node.y + 14} text-anchor="middle" font-size={10} fill="#9CA3AF">
        {node.sublabel.length > 20 ? `${node.sublabel.slice(0, 19)}...` : node.sublabel}
      </text>
    </g>
  );
}

function EdgeComponent({ edge }: { edge: PositionedEdge }) {
  if (edge.points.length < 2) return null;

  const style = EDGE_STYLES[edge.type] ?? EDGE_STYLES.navigates_to;
  const d = edge.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const lastIdx = edge.points.length - 1;
  const arrowPoint = edge.points[lastIdx];
  const prevPoint = edge.points[lastIdx - 1];
  const angle = Math.atan2(arrowPoint.y - prevPoint.y, arrowPoint.x - prevPoint.x);
  const arrowSize = 8;

  return (
    <g data-testid={`graph-edge-${edge.id}`} data-edge-type={edge.type}>
      <path
        d={d}
        fill="none"
        stroke={style.stroke}
        stroke-width={1.5}
        stroke-dasharray={style.dasharray}
      />
      <polygon
        points={`
          ${arrowPoint.x},${arrowPoint.y}
          ${arrowPoint.x - arrowSize * Math.cos(angle - Math.PI / 6)},${arrowPoint.y - arrowSize * Math.sin(angle - Math.PI / 6)}
          ${arrowPoint.x - arrowSize * Math.cos(angle + Math.PI / 6)},${arrowPoint.y - arrowSize * Math.sin(angle + Math.PI / 6)}
        `}
        fill={style.stroke}
      />
      {edge.label && (
        <text
          x={(edge.points[0].x + arrowPoint.x) / 2}
          y={(edge.points[0].y + arrowPoint.y) / 2 - 8}
          text-anchor="middle"
          font-size={9}
          fill={style.stroke}
        >
          {edge.label.length > 20 ? `${edge.label.slice(0, 19)}...` : edge.label}
        </text>
      )}
    </g>
  );
}
