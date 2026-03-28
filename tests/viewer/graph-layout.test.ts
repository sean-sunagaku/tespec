import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/core/viewer/graph/layout.js';
import type { GraphData } from '../../src/core/viewer/graph/transform.js';

const emptyGraph: GraphData = { nodes: [], edges: [] };

const singleNode: GraphData = {
  nodes: [
    {
      id: 'screen:login',
      type: 'screen',
      label: 'ログイン',
      sublabel: '/login',
      metadata: { caseCount: 3 },
    },
  ],
  edges: [],
};

const twoNodesOneEdge: GraphData = {
  nodes: [
    {
      id: 'screen:login',
      type: 'screen',
      label: 'ログイン',
      sublabel: '/login',
      metadata: { caseCount: 3 },
    },
    {
      id: 'screen:home',
      type: 'screen',
      label: 'ホーム',
      sublabel: '/',
      metadata: { caseCount: 2 },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'screen:login',
      target: 'screen:home',
      type: 'navigates_to',
      label: 'ログインする',
    },
  ],
};

function createLargeGraph(count: number): GraphData {
  return {
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `screen:s${i}`,
      type: 'screen' as const,
      label: `Screen ${i}`,
      sublabel: `/s${i}`,
      metadata: { caseCount: 1 },
    })),
    edges: Array.from({ length: count - 1 }, (_, i) => ({
      id: `e${i}`,
      source: `screen:s${i}`,
      target: `screen:s${i + 1}`,
      type: 'navigates_to' as const,
      label: `遷移${i}`,
    })),
  };
}

type PositionedNode = ReturnType<typeof computeLayout>['nodes'][number];

describe('グラフレイアウト計算', () => {
  describe('computeLayout', () => {
    it('1 ノードの GraphData でレイアウトを計算する → ノードに x, y, width, height が割り当てられる', () => {
      const result = computeLayout(singleNode);

      expect(result.nodes).toHaveLength(1);
      expect(typeof result.nodes[0].x).toBe('number');
      expect(typeof result.nodes[0].y).toBe('number');
      expect(typeof result.nodes[0].width).toBe('number');
      expect(typeof result.nodes[0].height).toBe('number');
    });

    it('2 ノード 1 エッジの GraphData でレイアウトを計算する → TB 方向で source が target より上に配置される', () => {
      const result = computeLayout(twoNodesOneEdge);

      const login = result.nodes.find((n) => n.id === 'screen:login') as PositionedNode;
      const home = result.nodes.find((n) => n.id === 'screen:home') as PositionedNode;
      expect(login.y).toBeLessThan(home.y);
    });

    it('デフォルトオプションでレイアウトを計算する → direction が TB で計算される', () => {
      const result = computeLayout(twoNodesOneEdge);

      const login = result.nodes.find((n) => n.id === 'screen:login') as PositionedNode;
      const home = result.nodes.find((n) => n.id === 'screen:home') as PositionedNode;
      expect(login.y).toBeLessThan(home.y);
    });

    it('LR 方向でレイアウトを計算する → source が target より左に配置される', () => {
      const result = computeLayout(twoNodesOneEdge, { direction: 'LR' });

      const login = result.nodes.find((n) => n.id === 'screen:login') as PositionedNode;
      const home = result.nodes.find((n) => n.id === 'screen:home') as PositionedNode;
      expect(login.x).toBeLessThan(home.x);
    });

    it('LayoutResult の width と height がグラフ全体を包含する → 全ノードの座標が width と height の範囲内に収まる', () => {
      const result = computeLayout(twoNodesOneEdge);

      for (const node of result.nodes) {
        expect(node.x + node.width / 2).toBeLessThanOrEqual(result.width);
        expect(node.y + node.height / 2).toBeLessThanOrEqual(result.height);
      }
    });

    describe('異常系', () => {
      it('ノード ID が重複する GraphData でレイアウトを計算する → エラーにならず最後のノード定義が使われる', () => {
        const dupeGraph: GraphData = {
          nodes: [
            {
              id: 'screen:a',
              type: 'screen',
              label: 'A-old',
              sublabel: '/a',
              metadata: {},
            },
            {
              id: 'screen:a',
              type: 'screen',
              label: 'A-new',
              sublabel: '/a',
              metadata: {},
            },
          ],
          edges: [],
        };
        expect(() => computeLayout(dupeGraph)).not.toThrow();
      });
    });

    describe('境界値', () => {
      it('空の GraphData でレイアウトを計算する → nodes が空配列で返る', () => {
        const result = computeLayout(emptyGraph);

        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
        expect(result.width).toBe(0);
        expect(result.height).toBe(0);
      });

      it('50 ノード規模の GraphData でレイアウトを計算する → レイアウト計算が完了する', () => {
        const result = computeLayout(createLargeGraph(50));

        expect(result.nodes).toHaveLength(50);
        for (const node of result.nodes) {
          expect(typeof node.x).toBe('number');
          expect(typeof node.y).toBe('number');
        }
      });

      it('ノード同士が重ならないレイアウトを計算する → 全ノードの矩形が他のノードと重複しない', () => {
        const result = computeLayout(createLargeGraph(10));

        for (let i = 0; i < result.nodes.length; i++) {
          for (let j = i + 1; j < result.nodes.length; j++) {
            const a = result.nodes[i];
            const b = result.nodes[j];
            const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
            const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2;
            expect(overlapX && overlapY, `ノード ${a.id} と ${b.id} が重なっている`).toBe(false);
          }
        }
      });
    });
  });
});
