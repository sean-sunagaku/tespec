# Step 3: モジュール設計（確定版）

## ファイル構成

追加: 3ファイル、変更: 2ファイル

```
src/core/viewer/
  graph/                        ← NEW
    transform.ts                ← specsToGraph() — 純関数、独立テスト対象
    layout.ts                   ← computeLayout() — dagre 依存、独立テスト対象
  components/
    NodeGraph.tsx               ← NEW — SVG 描画 + d3-zoom + 型定義 inline
    (既存4ファイルは変更なし)
  client-entry.tsx              ← CHANGE — NodeGraph 組み込み、3カラム化

tsup.config.ts                  ← CHANGE — noExternal に dagre/d3 追加
package.json                    ← CHANGE — 依存追加
```

## モジュール一覧

| モジュール | 責務 | 公開インターフェース | 変化の理由 |
|-----------|------|-------------------|-----------|
| graph/transform.ts | SpecsData → GraphData 変換 | `specsToGraph(data: SpecsInput): GraphData` | スキーマ変更時のみ |
| graph/layout.ts | dagre レイアウト計算 | `computeLayout(data: GraphData, options?: LayoutOptions): LayoutResult` | レイアウトアルゴリズム変更時のみ |
| components/NodeGraph.tsx | 3層統合 + SVG描画 + d3-zoom | `NodeGraph({ data, onNodeClick })` | グラフUI変更時 |

## 依存グラフ

```
schema.ts（型定義のみ）
  ↑
graph/transform.ts ────────── (parser.ts に非依存)
  ↑
graph/layout.ts (@dagrejs/dagre)
  ↑
components/NodeGraph.tsx (d3-zoom, d3-selection, preact)
  ↑
client-entry.tsx
```

## 依存ルール

1. graph/ は schema.ts の型のみに依存する（parser.ts, viewer/ を import しない）
2. dagre は graph/layout.ts のみが依存する（viewer/ に漏れない）
3. d3-zoom は NodeGraph.tsx のみが依存する（graph/ に漏れない）
4. graph/ → viewer/ への逆依存禁止（循環防止）

## 型定義（NodeGraph.tsx 内に inline）

```typescript
type NodeType = 'screen' | 'setup';
type EdgeType = 'navigates_to' | 'workflow' | 'given';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sublabel: string;
  metadata: { caseCount?: number; stepCount?: number; };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

interface GraphData { nodes: GraphNode[]; edges: GraphEdge[]; }

interface PositionedNode extends GraphNode {
  x: number; y: number; width: number; height: number;
}

interface PositionedEdge extends GraphEdge {
  points: Array<{ x: number; y: number }>;
}

interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number; height: number;
}
```

## graph/transform.ts の入力型

```typescript
import type { Screen, Setup, Workflow } from '../../schema.js';

interface SpecsInput {
  screens: Screen[];
  setups: Setup[];
  workflows: Workflow[];
}
```

parser.ts の ParsedProject ではなく SpecsInput を使う（ブラウザバンドルに node:fs が混入しない）。

## graph/layout.ts の設定型

```typescript
interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}
```

dagre の内部型を漏らさない。

## 3カラムレイアウト（client-entry.tsx 変更）

View 型は変更なし。dashboard ビュー時のみ3カラム化:

```
[nav w-64] [既存カード flex-1] [NodeGraph w-1/2 border-l]
```

detail ビュー（screen/unit/setup/workflow）は現状の2カラム維持。
NodeGraph のノードクリック → navigate('screen'|'setup', id) で既存 detail へ遷移。

## d3-zoom 統合パターン（PE 検証済み）

```tsx
// NodeGraph.tsx 内
const svgRef = useRef<SVGSVGElement>(null);
const [transform, setTransform] = useState(zoomIdentity);

useEffect(() => {
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => setTransform(event.transform));
  select(svgRef.current!).call(zoomBehavior);
  return () => { select(svgRef.current!).on('.zoom', null); };
}, []);

// <g transform={...}> で Preact state から適用（DOM 直接操作しない）
```

## tsup.config.ts 変更（2行追記のみ）

```typescript
noExternal: ['preact', '@dagrejs/dagre', 'd3-zoom', 'd3-selection'],
esbuildOptions(options) {
  options.jsx = 'automatic';
  options.jsxImportSource = 'preact';
  options.mainFields = ['browser', 'module', 'main']; // dagre CJS 解決
},
```

## テスト戦略

| 対象 | テスト手法 | モック |
|------|----------|-------|
| graph/transform.ts | vitest 純関数テスト | 不要 |
| graph/layout.ts | vitest 純関数テスト | 不要 |
| NodeGraph.tsx | @testing-library/preact | d3-zoom, d3-selection をモック |

## Devil's Advocate 指摘と対応

| 指摘 | 対応 |
|------|------|
| graph/ を src/core/ 直下に分離は YAGNI | 採用: viewer/graph/ に配置。必要時に git mv |
| GraphNode/GraphEdge/GraphTooltip の別ファイルは過剰 | 採用: NodeGraph.tsx 内に inline。200行超で分離 |
| types.ts は不要 | 採用: inline 定義。export 需要が出たら分離 |
| layout.ts 分離は過剰 | 不採用: dagre 依存の隔離とテスト容易性のため分離を維持 |
