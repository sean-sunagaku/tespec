# Design Log: tespec viewer ノードグラフ可視化

## セッション情報
- テーマ: ノードグラフ可視化のモジュール設計
- モード: Standard
- 前提: design-discussion ADR で案B (dagre + d3-zoom + Preact SVG) 確定済み
- 開始日: 2026-03-28

## Phase A 回答
- ノードクリック: 3カラム（nav + graph + detail panel）、グラフは常に表示
- モジュール配置: src/core/graph/ に分離（viewer 非依存、CLI 再利用可能）

---

## Step 1+3 統合: モジュール設計確定（2026-03-28）

### 議論参加エージェント
- module-designer: SRP観点のモジュール分割・インターフェース設計
- dependency-analyst: 依存方向・ブラウザバンドル境界の検証
- devils-advocate: YAGNI チェック・1ファイル案の提示

### 論点と結論

#### 1. ファイル分割数（DA 1ファイル案 vs 7ファイル案）
**採用: 3ファイル追加（中間案）**
- transform.ts + layout.ts は純粋関数として独立テスト必要（テスト可能性が分離の根拠）
- GraphNode/GraphEdge/GraphTooltip/types は NodeGraph.tsx 内 inline（200行超えたら分離）
- 棄却: 7ファイル案（過剰分離）、1ファイル案（テスト容易性を犠牲にする）

#### 2. graph/ の配置
**採用: src/core/viewer/graph/**
- DA 指摘「CLI 再利用は仮想要件」を受け入れ
- 将来 CLI 利用が必要になったら git mv で移動
- 棄却: src/core/graph/（CLI 再利用は現時点で YAGNI）

#### 3. 3カラムレイアウト
**採用: Phase 1 で dashboard ビューのみ3カラム化**
- グラフの価値は「常に見える全体像」（タブ切替案は価値を損なう）
- detail ビュー時は現状の2カラム維持
- View 型変更不要

#### 4. specsToGraph の引数型
**採用: SpecsInput（schema.ts の型のみ使用）**
- ParsedProject は parser.ts 経由で node:fs に依存 → ブラウザバンドル汚染リスク
- SpecsInput は { screens, setups, workflows } の構造的サブセット
- SpecsData（client-entry.tsx）も ParsedProject も両方から structural subtyping で渡せる

### 確定モジュール一覧

```
src/core/viewer/
  graph/
    transform.ts      ← NEW: specsToGraph(data: SpecsInput): GraphData
    layout.ts         ← NEW: computeLayout(data: GraphData, options?): LayoutResult
  components/
    NodeGraph.tsx     ← NEW: SVG描画 + d3-zoom + 型・subコンポーネントをinline
  client-entry.tsx    ← CHANGE: NodeGraph組み込み + dashboard 3カラム化
```

追加: 3ファイル、変更: 1ファイル（+ tsup.config.ts / package.json）

### 依存グラフ（循環依存なし・検証済み）

```
schema.ts
  ↑
viewer/graph/transform.ts
  ↑
viewer/graph/layout.ts  ←── @dagrejs/dagre
  ↑
viewer/components/NodeGraph.tsx  ←── d3-zoom, d3-selection, preact
  ↑
viewer/client-entry.tsx
```

保証:
- graph/ → viewer/ への依存なし
- parser.ts（node:fs）→ graph/ への依存なし（SpecsInput 設計で防止）
- dagre/d3 はブラウザバンドルのみに含まれる

### 公開インターフェース

**graph/transform.ts:**
```typescript
export interface SpecsInput { screens: Screen[]; setups: Setup[]; workflows: Workflow[]; }
export function specsToGraph(data: SpecsInput): GraphData
```

**graph/layout.ts:**
```typescript
export interface LayoutOptions { direction?: 'TB'|'LR'; nodeWidth?: number; nodeHeight?: number; rankSep?: number; nodeSep?: number; }
export function computeLayout(data: GraphData, options?: LayoutOptions): LayoutResult
```

**components/NodeGraph.tsx:**
```typescript
export function NodeGraph(props: { data: SpecsInput; onNodeClick: (type: 'screen'|'setup', id: string) => void }): JSX.Element
```

### 確定型定義（NodeGraph.tsx 内 inline）

```typescript
type NodeType = 'screen' | 'setup';
type EdgeType = 'navigates_to' | 'workflow' | 'given';

interface GraphNode {
  id: string;        // `screen:${id}` or `setup:${id}`
  type: NodeType;
  label: string;     // screen.title / setup.title
  sublabel: string;  // screen.route / setup.setup(ID)
  metadata: { caseCount?: number; stepCount?: number; };
}

interface GraphEdge { id: string; source: string; target: string; type: EdgeType; label?: string; }
interface GraphData { nodes: GraphNode[]; edges: GraphEdge[]; }

interface PositionedNode extends GraphNode { x: number; y: number; width: number; height: number; }
interface PositionedEdge extends GraphEdge { points: Array<{ x: number; y: number }>; }
interface LayoutResult { nodes: PositionedNode[]; edges: PositionedEdge[]; width: number; height: number; }
```

### tsup.config.ts 追加変更

```typescript
noExternal: ['preact', '@dagrejs/dagre', 'd3-zoom', 'd3-selection']
```

### 未解決事項（実装フェーズで決定）
- ノードの width/height デフォルト値
- GraphTooltip の表示内容
- d3-zoom の初期スケール・パン範囲

---
