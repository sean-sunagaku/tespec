# Step 4: ADR + 実装アクションプラン

## ADR-001: tespec view ノードグラフ可視化

### ステータス
承認済み（2026-03-28）

### コンテキスト

tespec view のブラウザビューアーは現在リスト/カード形式でスペックを表示しているが、50+ screens 規模のプロジェクトでは画面遷移の全体像を把握できない。Phase 1 として Read-only のノードグラフ表示を、Phase 2 としてノード編集 → YAML 書き戻しを計画している。

現在のアーキテクチャ:
- Preact 10.29 + Hono サーバー + tsup (esbuild) バンドル
- SSE でリアルタイム更新
- Tailwind CSS (CDN)
- viewer-client.js: ~20KB gzip

### 決定

**案B: dagre + d3-zoom + Preact SVG コンポーネント** を採用する。

3層分離アーキテクチャ:
1. **データ変換層** (`transform.ts`): SpecsData → GraphData
2. **レイアウト計算層** (`layout.ts`): dagre による階層レイアウト (rankdir: TB)
3. **描画層** (`NodeGraph.tsx` + SVG コンポーネント): Preact JSX + d3-zoom

ダッシュボード配置: **Split view** — 既存サイドバー + 左カード + 右グラフの並列表示

### 却下した案

**案A: 現状維持（グラフなし）**
- 理由: Phase 1 の要件を満たさない。50+ screens の遷移把握が不可能で、ビューアーの差別化価値がない。ユーザー課題が未解決のまま残る。

**案C: Cytoscape.js（DOM 直接操作）**
- 理由: バンドルサイズ +111KB gzip（案B の 8.5 倍）が CLI ツールとして過剰。Cytoscape の Canvas/SVG 直接操作と Preact の仮想 DOM が競合するリスクがあり、SSE 更新時の状態同期が困難。Tailwind ベースの既存 UI との一貫性も損なわれる。tespec の規模（~100 ノード）に対してオーバースペック。

**案D: React 移行 + React Flow (@xyflow/react)**
- 理由: Phase 1（Read-only 表示）のために Preact → React 全移行はコストが不釣り合い。全コンポーネント書き換え + テスト移行（@testing-library/preact → react）+ tsup 設定変更の三重タスクで、Phase 1 デリバリーが大幅遅延する。バンドルサイズ +118KB gzip。Phase 2 開始時に再評価する。

### 残存リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Phase 2 で SVG カスタム実装の上限に到達 | 中 | 3層分離により描画層だけ差し替え可能。データ変換層・レイアウト層は再利用。Phase 2 開始時に React Flow 移行を再評価（移行判定基準を後述） |
| dagre の開発停滞（最終リリースが古い） | 低 | dagre はレイアウトアルゴリズムとして完成しており、バグ修正の必要性が低い。代替として @dagrejs/dagre or graphlib 直接利用も可能 |
| d3-zoom と Preact の状態管理の不整合 | 低 | d3-zoom の transform を Preact state に同期する設計パターンは確立されている。useRef で SVG 要素を取得し、useEffect で d3-zoom をアタッチ |
| 50+ ノードでのレンダリングパフォーマンス | 低 | dagre は 100 ノードで <10ms。SVG は 500+ ノードまで問題なし。必要に応じてビューポート外ノードの非描画で対応可能 |

### 結果

- バンドルサイズ増: +13KB gzip（合計 ~35-40KB gzip）
- 新規ファイル: 7ファイル（graph/ 3 + components/ 4）
- 既存ファイル変更: 3ファイル（package.json, tsup.config.ts, App.tsx）
- 既存テスト変更: なし（@testing-library/preact そのまま）
- Phase 2 への移行パス: d3-drag 追加 + Hono API PATCH 実装

---

## 実装アクションリスト

### 依存関係図

```
[1] 依存追加 (package.json, tsup.config.ts)
 │
 ├──[2] 型定義 (graph/types.ts)
 │    │
 │    ├──[3] データ変換 (graph/transform.ts) + テスト
 │    │    │
 │    │    └──[4] レイアウト計算 (graph/layout.ts) + テスト
 │    │         │
 │    │         └──[6] NodeGraph 統合 (components/NodeGraph.tsx) + テスト
 │    │
 │    ├──[5a] GraphNode (components/GraphNode.tsx)
 │    ├──[5b] GraphEdge (components/GraphEdge.tsx)
 │    └──[5c] GraphTooltip (components/GraphTooltip.tsx)
 │
 └──[7] Split view 統合 (App.tsx 変更) + テスト
      │
      └──[8] E2E 検証 + ビルド確認
```

### アクション詳細

#### [1] 依存追加・ビルド設定

| 項目 | 内容 |
|------|------|
| 優先度 | P0（最初に実行） |
| ブロック | [2] 以降すべて |

**変更ファイル:**
- `package.json`: dagre, @types/dagre, d3-zoom, d3-selection を追加
- `tsup.config.ts`: ブラウザバンドルの noExternal に dagre, d3-zoom, d3-selection を追加

**確認:**
- `pnpm build` が正常に完了すること
- viewer-client.js にグラフライブラリがバンドルされること

---

#### [2] 型定義

| 項目 | 内容 |
|------|------|
| 優先度 | P0 |
| ブロック | [3], [4], [5a-c], [6] |

**新規ファイル:** `src/core/viewer/graph/types.ts`

**定義する型:**
```typescript
type NodeType = 'screen' | 'setup';
type EdgeType = 'navigates_to' | 'workflow' | 'given';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sublabel: string;
  metadata: { caseCount?: number; stepCount?: number; route?: string; };
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
  width: number;
  height: number;
}
```

---

#### [3] データ変換層

| 項目 | 内容 |
|------|------|
| 優先度 | P0 |
| 依存 | [2] |
| ブロック | [4] |

**新規ファイル:** `src/core/viewer/graph/transform.ts`
**テストファイル:** `tests/viewer/graph-transform.test.ts`

**関数:** `specsToGraph(data: SpecsData): GraphData`

**変換ロジック:**
1. 各 Screen → GraphNode (type: 'screen')
2. 各 Setup → GraphNode (type: 'setup')
3. 各 Case.navigates_to → GraphEdge (type: 'navigates_to', label: case.action)
4. 各 Workflow.steps の連続ペア → GraphEdge (type: 'workflow', label: `${workflow.workflow} #${i+1}`)
5. 各 Case.given → GraphEdge (type: 'given')
6. 重複エッジの除去（同一 source-target-type → ラベル結合）

**テストケース:**
- 空データ → 空グラフ
- Screen のみ → ノードのみ、エッジなし
- navigates_to あり → 正しいエッジ生成
- Workflow → steps 間の順序エッジ生成
- Case.given → Screen-Setup エッジ生成
- given が配列 → 複数エッジ生成
- 重複エッジ → ラベル結合

---

#### [4] レイアウト計算層

| 項目 | 内容 |
|------|------|
| 優先度 | P0 |
| 依存 | [2], [3] |
| ブロック | [6] |

**新規ファイル:** `src/core/viewer/graph/layout.ts`
**テストファイル:** `tests/viewer/graph-layout.test.ts`

**関数:** `computeLayout(data: GraphData, options?: LayoutOptions): LayoutResult`

**テストケース:**
- 空グラフ → 空レイアウト
- 1ノード → 座標が割り当てられる
- 2ノード + 1エッジ → TB 方向で上下に配置
- 全ノードに x, y, width, height が設定
- 全エッジに points 配列が設定
- LayoutResult の width/height がグラフ全体を包含

---

#### [5a-c] SVG コンポーネント

| 項目 | 内容 |
|------|------|
| 優先度 | P1 |
| 依存 | [2] |
| ブロック | [6] |

**新規ファイル:**
- `src/core/viewer/components/GraphNode.tsx` — Screen: 角丸矩形・青系、Setup: 角丸矩形・緑系
- `src/core/viewer/components/GraphEdge.tsx` — navigates_to: 実線青、workflow: 破線紫、given: 点線緑
- `src/core/viewer/components/GraphTooltip.tsx` — HTML オーバーレイ（position: absolute）

---

#### [6] NodeGraph 統合コンポーネント

| 項目 | 内容 |
|------|------|
| 優先度 | P1 |
| 依存 | [3], [4], [5a-c] |
| ブロック | [7] |

**新規ファイル:** `src/core/viewer/components/NodeGraph.tsx`
**テストファイル:** `tests/viewer/node-graph.test.tsx`

**責務:**
1. specsToGraph() → computeLayout() パイプライン
2. `<svg>` に d3-zoom アタッチ（useRef + useEffect）
3. zoom transform を Preact state で管理
4. PositionedNode → `<GraphNode>` / PositionedEdge → `<GraphEdge>` 描画
5. hover → `<GraphTooltip>` 表示
6. data 変更時にレイアウト再計算（useMemo）

**テストケース:**
- データあり → SVG が描画される
- ノードクリック → onNodeClick コールバック呼び出し
- 空データ → 空状態メッセージ表示

---

#### [7] Split view 統合

| 項目 | 内容 |
|------|------|
| 優先度 | P1 |
| 依存 | [6] |
| ブロック | [8] |

**変更ファイル:** `src/core/viewer/components/App.tsx`

**変更内容:**
- dashboard ビューの `<main>` を flex split view に変更
- 左: 既存カード表示（w-1/2, overflow-y-auto）
- 右: `<NodeGraph>` (w-1/2, border-l)
- NodeGraph のノードクリック → navigate() に接続

**テスト:** `tests/viewer/viewer-dashboard.test.tsx` に NodeGraph 統合テスト追加

---

#### [8] E2E 検証・ビルド確認

| 項目 | 内容 |
|------|------|
| 優先度 | P2 |
| 依存 | [7] |

**確認:**
- `pnpm build` 成功
- `pnpm test` 全パス
- `pnpm check` パス
- viewer-client.js ≤ 40KB gzip
- `tespec view` でビューアー正常起動
- split view でカード + グラフ並列表示
- ズーム/パン/ホバー動作
- SSE 更新でグラフ再描画

---

## 実装順序サマリー

| 順序 | アクション | ファイル | テスト |
|:---:|-----------|----------|--------|
| 1 | [1] 依存追加 | package.json, tsup.config.ts | ビルド確認 |
| 2 | [2] 型定義 | graph/types.ts | なし |
| 3 | [3] データ変換 | graph/transform.ts | graph-transform.test.ts |
| 4 | [4] レイアウト計算 | graph/layout.ts | graph-layout.test.ts |
| 5 | [5a-c] SVG コンポーネント | GraphNode/Edge/Tooltip.tsx | (統合テストで検証) |
| 6 | [6] NodeGraph 統合 | NodeGraph.tsx | node-graph.test.tsx |
| 7 | [7] Split view | App.tsx 変更 | dashboard テスト追加 |
| 8 | [8] E2E 検証 | なし | 全テスト + ビルド |

---

## Phase 2 移行判定基準

### React Flow 移行を再検討するトリガー条件

以下の **いずれか1つ** に該当した場合、Phase 2 で React Flow への移行を検討する:

1. **ドラッグ接続作成**: ノード間の接続をドラッグで作成/削除する要件（ノード位置のドラッグ移動だけなら d3-drag で対応可能 → 移行不要）
2. **インラインエディタ**: ノード上で直接テキスト編集が必要（SVG 内のフォーム要素は制約が多い）
3. **複合インタラクション**: ミニマップ + 自動フィット + 選択範囲の3つ以上が同時に必要
4. **200+ ノード**: 仮想化レンダリングが必要になった場合

### 移行時の再利用可能資産

- `graph/types.ts`: 型定義（React Flow の Node/Edge にマッピング）
- `graph/transform.ts`: specsToGraph() は完全再利用
- `graph/layout.ts`: React Flow は dagre をプラグインとして使用可能

### 書き換えが必要な範囲

- NodeGraph.tsx → ReactFlowGraph.tsx
- GraphNode/Edge.tsx → React Flow カスタムノード/エッジ
- 全コンポーネント: Preact → React import 変更
- テスト: @testing-library/preact → @testing-library/react
- tsup.config.ts: jsxImportSource 変更
- package.json: preact 削除、react + @xyflow/react 追加
