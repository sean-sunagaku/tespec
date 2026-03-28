# Step 2: 設計案の比較

## 概要

tespec view のノードグラフ可視化について4案を比較評価する。
Phase 1（Read-only ノードグラフ）の実装を対象とし、Phase 2（編集機能）への拡張性も考慮する。

## 現在のアーキテクチャ

```
src/core/viewer/
  client-entry.tsx     # BrowserApp (Preact SPA)
  server.ts            # Hono サーバー (/api/specs, /events SSE)
  template.ts          # HTML テンプレート (Tailwind CDN)
  components/
    App.tsx
    ScreenDetail.tsx
    SetupDetail.tsx
    UnitDetail.tsx
    WorkflowDetail.tsx
```

- **フレームワーク**: Preact 10.29 + Hono + tsup (esbuild)
- **バンドル**: `noExternal: ['preact']`, `jsxImportSource: 'preact'`, platform: 'browser'
- **推定バンドルサイズ**: ~20KB gzip (viewer-client.js)

## グラフデータモデル

### ノード種別
| 種別 | ソース | ID フィールド | 表示情報 |
|------|--------|---------------|----------|
| Screen | `Screen` | `screen` | title, route, cases 数 |
| Setup | `Setup` | `setup` | title, steps 数 |

### エッジ種別
| 種別 | ソース | 方向 | ラベル |
|------|--------|------|--------|
| navigates_to | `Case.navigates_to` | Screen → Screen | case の action |
| workflow | `Workflow.steps[]` | Screen → Screen (順序) | workflow 名 + step 番号 |
| given | `Case.given` | Screen → Setup | "前提条件" |

---

## 案A: 現状維持（グラフなし）

### 概要
変更なし。現在のリスト/カード表示を維持。

### アーキテクチャ
変更なし。

### ファイル構成
変更なし。

### メリット
- 開発コスト: 0
- リスク: 0
- バンドルサイズ増: 0

### デメリット
- ユーザー価値: 0。50画面超の遷移関係を把握する手段がない
- tespec view の差別化価値がない
- 機会損失が最大

### 評価
**棄却。** Phase 1 の要件を満たさない。

---

## 案B: dagre + d3-zoom + Preact SVG コンポーネント [推奨]

### 概要
dagre でレイアウト計算、d3-zoom でパン/ズーム、Preact の JSX で SVG 描画。
3層分離アーキテクチャで関心を分離する。

### アーキテクチャ図

```
┌──────────────────────────────────────────────────────────────────────┐
│  BrowserApp (client-entry.tsx)                                       │
│                                                                      │
│  ┌────────┐  ┌──────────────────────────────────────────────────┐    │
│  │ Sidebar │  │  <main> Split View (flex)                       │    │
│  │ (既存   │  │                                                  │    │
│  │  ナビ)  │  │  ┌─────────────────┐  ┌──────────────────────┐  │    │
│  │         │  │  │ 左: Dashboard   │  │ 右: NodeGraph.tsx    │  │    │
│  │ Screen  │  │  │ (既存カード表示) │  │                      │  │    │
│  │ Unit    │  │  │                 │  │ Layer 1: データ変換   │  │    │
│  │ Setup   │  │  │  CoverageSummary│  │ specsToGraph()       │  │    │
│  │ Workflow│  │  │  ScreenCards    │  │     ▼                │  │    │
│  │         │  │  │  UnitCards      │  │ Layer 2: レイアウト   │  │    │
│  │         │  │  │  SetupCards     │  │ dagre.layout()       │  │    │
│  │         │  │  │  WorkflowCards  │  │     ▼                │  │    │
│  │         │  │  │                 │  │ Layer 3: SVG 描画    │  │    │
│  │         │  │  │                 │  │ <svg> + d3-zoom      │  │    │
│  │         │  │  │                 │  │ GraphNode / GraphEdge│  │    │
│  │         │  │  │                 │  │ GraphTooltip         │  │    │
│  │         │  │  └─────────────────┘  └──────────────────────┘  │    │
│  └────────┘  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
         ▲ SSE update                          ▲ SSE update
         │                                     │
    ┌────┴─────────────────────────────────────┴────┐
    │  Hono Server (server.ts)                      │
    │  /api/specs → JSON                            │
    │  /events → SSE                                │
    └───────────────────────────────────────────────┘
```

### ファイル構成

```
src/core/viewer/
  graph/
    types.ts          # GraphNode, GraphEdge, LayoutResult 型定義
    transform.ts      # specsToGraph(): SpecsData → GraphData 変換
    layout.ts         # computeLayout(): dagre レイアウト計算
  components/
    NodeGraph.tsx     # メインコンポーネント (3層統合 + d3-zoom)
    GraphNode.tsx     # SVG ノード描画 (Screen/Setup を視覚的に区別)
    GraphEdge.tsx     # SVG エッジ描画 (navigates_to/workflow/given を色分け)
    GraphTooltip.tsx  # ホバー時の情報プレビュー
```

### データフロー

```
SpecsData (SSE/fetch)
  │
  ▼
specsToGraph()          ← graph/transform.ts
  │ Screen → ScreenNode (type: 'screen', id, title, route, caseCount)
  │ Setup → SetupNode (type: 'setup', id, title, stepCount)
  │ Case.navigates_to → Edge (type: 'navigates_to', source, target, label)
  │ Workflow.steps → Edge (type: 'workflow', source, target, label)
  │ Case.given → Edge (type: 'given', source, target)
  ▼
GraphData { nodes: GraphNode[], edges: GraphEdge[] }
  │
  ▼
computeLayout()         ← graph/layout.ts
  │ dagre.graphlib.Graph に node/edge を追加
  │ dagre.layout() で座標計算 (rankdir: TB)
  ▼
LayoutResult { nodes: PositionedNode[], edges: PositionedEdge[] }
  │
  ▼
NodeGraph.tsx           ← SVG 描画
  │ <svg> に d3-zoom をアタッチ (useRef + useEffect)
  │ transform 状態を Preact state で管理
  │ PositionedNode → <GraphNode> コンポーネント
  │ PositionedEdge → <GraphEdge> コンポーネント
  │ hover state → <GraphTooltip> コンポーネント
  ▼
ブラウザ表示
```

### 依存追加

| パッケージ | サイズ (raw) | サイズ (gzip) | 用途 |
|-----------|-------------|--------------|------|
| dagre | ~30KB | ~9KB | レイアウト計算 |
| d3-zoom | ~12KB | ~4KB | パン/ズーム |
| d3-selection | (d3-zoom の依存) | (含む) | DOM 選択 |
| **合計** | **~42KB** | **~13KB** | |

### バンドルサイズ見積もり
- 現在: ~20KB gzip
- 追加後: ~35-40KB gzip
- **増加率: ~75%、絶対値としては十分軽量**

### パフォーマンス見積もり (100ノード + 200エッジ)
- dagre レイアウト計算: **<10ms**
- Preact SVG レンダリング: **<5ms**
- d3-zoom transform: DOM 要素数に非依存、**即時**
- ボトルネック閾値: 500+ ノードから（tespec 想定規模外）

### Phase 2 拡張パス
- ドラッグ移動: d3-drag (~6KB) 追加、dagre 結果のオーバーライド
- ノード編集: SVG click → Preact モーダル → Hono API PATCH → YAML 書き戻し
- 接続作成: SVG ドラッグイベントで新エッジ作成（高度な要件。必要時に React Flow 再検討）

### メリット
- **最小バンドルサイズ増** (~13KB gzip)
- **既存スタック完全互換**: Preact + tsup そのまま
- **テスト変更なし**: @testing-library/preact がそのまま使える
- **3層分離で保守性が高い**: transform/layout/rendering を独立テスト可能
- **カスタマイズ自由度**: SVG コンポーネントなので Tailwind と視覚的一貫性が保てる

### デメリット
- ズーム/パン/ドラッグの実装が自前（d3-zoom で軽減されるが React Flow ほどの完成度ではない）
- Phase 2 でリッチなインタラクションが必要になった場合の上限がある

---

## 案C: Cytoscape.js（DOM 直接操作）

### 概要
Cytoscape.js をグラフ描画エンジンとして使用。Canvas/SVG を直接操作し、cytoscape-dagre でレイアウト。

### アーキテクチャ図

```
┌───────────────────────────────────────────────────┐
│  BrowserApp (Preact)                              │
│                                                   │
│  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Dashboard    │  │ CytoscapeGraph.tsx        │  │
│  │ (既存)       │  │                           │  │
│  │              │  │  useRef → <div>           │  │
│  │              │  │     ▼                     │  │
│  │              │  │  useEffect(() => {        │  │
│  │              │  │    cy = cytoscape({       │  │
│  │              │  │      container: ref,      │  │
│  │              │  │      elements: [...],     │  │
│  │              │  │      layout: { dagre },   │  │
│  │              │  │    })                     │  │
│  │              │  │  })                       │  │
│  │              │  │                           │  │
│  │              │  │  [Preact 外の DOM 操作]    │  │
│  └──────────────┘  └───────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### ファイル構成

```
src/core/viewer/
  graph/
    types.ts              # Cytoscape 用データ型
    transform.ts          # SpecsData → Cytoscape Elements 変換
  components/
    CytoscapeGraph.tsx    # useRef + useEffect で Cytoscape を管理
```

### 依存追加

| パッケージ | サイズ (raw) | サイズ (gzip) | 用途 |
|-----------|-------------|--------------|------|
| cytoscape | ~340KB | ~100KB | グラフエンジン |
| cytoscape-dagre | ~5KB | ~2KB | dagre レイアウト |
| dagre | ~30KB | ~9KB | (cytoscape-dagre の依存) |
| **合計** | **~375KB** | **~111KB** | |

### Preact との共存リスク
- **DOM 競合**: Cytoscape が container div 内の DOM を直接操作。Preact の仮想 DOM diff が Cytoscape の描画を破壊するリスク
- **対策**: useRef で container を分離し、Preact の再レンダリングから隔離する必要がある
- **状態同期**: Cytoscape のイベント (tap, mouseover) → Preact state への橋渡しが必要。非同期の競合が起きやすい
- **SSE 更新時**: data 変更 → cy.json() で全要素再設定 → レイアウト再計算。Preact の更新サイクルと同期が難しい

### メリット
- 大規模グラフ (1000+ ノード) に強い Canvas レンダリング
- フィルタリング、アニメーション等が組み込み
- 網羅的な API

### デメリット
- **バンドルサイズ +111KB gzip** (案B の 8.5 倍)
- **Preact との統合が複雑**: DOM 直接操作 vs 仮想 DOM の競合
- **スタイル不統一**: Canvas ベースのため Tailwind CSS との一貫性が失われる
- **オーバースペック**: tespec が必要とする機能に対して過剰
- **Phase 2 拡張コスト**: Cytoscape イベント → Preact 状態の橋渡しが Phase 2 でさらに複雑化

---

## 案D: React 移行 + React Flow (@xyflow/react)

### 概要
Preact → React に移行し、React Flow でノードグラフを実装。

### アーキテクチャ図

```
┌───────────────────────────────────────────────────────┐
│  BrowserApp (React)  ← Preact から移行                │
│                                                       │
│  ┌──────────────┐  ┌────────────────────────────────┐ │
│  │ Dashboard    │  │ <ReactFlowProvider>            │ │
│  │ (React に    │  │   <ReactFlow                   │ │
│  │  書き換え)   │  │     nodes={nodes}              │ │
│  │              │  │     edges={edges}              │ │
│  │              │  │     nodeTypes={customTypes}    │ │
│  │              │  │   >                            │ │
│  │              │  │     <MiniMap />                │ │
│  │              │  │     <Controls />               │ │
│  │              │  │     <Background />             │ │
│  │              │  │   </ReactFlow>                 │ │
│  └──────────────┘  └────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### 移行影響範囲

| 変更対象 | 影響 |
|---------|------|
| package.json | `preact` → `react` + `react-dom` + `@xyflow/react` |
| tsup.config.ts | `jsxImportSource: 'react'`, `noExternal: ['react', 'react-dom']` |
| client-entry.tsx | `preact` → `react` import 全書き換え |
| 全コンポーネント (6ファイル) | `preact/hooks` → `react` import 変更、`class` → `className` |
| テスト | `@testing-library/preact` → `@testing-library/react` 全書き換え |
| template.ts | 変更なし (HTML テンプレート) |

### 依存追加

| パッケージ | サイズ (raw) | サイズ (gzip) | 用途 |
|-----------|-------------|--------------|------|
| react + react-dom | ~140KB | ~42KB | UI フレームワーク (Preact 置換) |
| @xyflow/react | ~300KB | ~80KB | ノードグラフ |
| **合計** | **~440KB** | **~122KB** | |

※ Preact (~4KB gzip) が不要になるため、純増は ~118KB gzip

### メリット
- React Flow は業界標準のノードグラフ UI。カスタムノード、ミニマップ、Controls が組み込み
- Phase 2 のドラッグ&ドロップ、接続作成に最も親和性が高い
- React エコシステム全体へのアクセス

### デメリット
- **フレームワーク移行 + グラフ実装の二重タスク**: Phase 1 のスコープが大幅に膨張
- **バンドルサイズ +118KB gzip** (案B の 9 倍)
- **既存テスト全書き換え**: @testing-library/preact → @testing-library/react
- **全コンポーネント書き換え**: 6ファイル + client-entry.tsx
- **tsup 設定変更リスク**: esbuild の React バンドルで予期しない問題が起きる可能性
- **Preact 選択理由の否定**: tespec が Preact を選んだ理由（軽量さ）を放棄

---

## スコアリング表（SA + PM 統合）

### SA 評価（技術観点）

| 評価軸 | 案A | 案B | 案C | 案D |
|--------|:---:|:---:|:---:|:---:|
| 技術的実現性 | 5 | 5 | 3 | 3 |
| 工数・コスト | 5 | 4 | 2 | 1 |
| 保守性・拡張性 | 1 | 4 | 3 | 5 |
| リスク (高=低リスク) | 5 | 4 | 2 | 2 |
| **小計** | **16** | **17** | **10** | **11** |

### PM 評価（ビジネス観点）

| 評価軸 | 案A | 案B | 案C | 案D |
|--------|:---:|:---:|:---:|:---:|
| ビジネス価値 | 1 | 4 | 4 | 5 |
| 工数・コスト | 5 | 4 | 2 | 1 |
| 保守性・拡張性 | 1 | 3 | 3 | 5 |
| リスク (高=悪) | 5 | 4 | 2 | 1 |
| **小計** | **12** | **15** | **11** | **12** |

### 統合スコア（SA + PM 平均）

| 評価軸 | 案A | **案B** | 案C | 案D |
|--------|:---:|:---:|:---:|:---:|
| 技術的実現性 (SA) | 5 | **5** | 3 | 3 |
| ビジネス価値 (PM) | 1 | **4** | 4 | 5 |
| 工数・コスト (SA/PM一致) | 5 | **4** | 2 | 1 |
| 保守性・拡張性 (SA/PM平均) | 1 | **3.5** | 3 | 5 |
| リスク (SA/PM平均) | 5 | **4** | 2 | 1.5 |
| **合計** | **17** | **20.5** | **14** | **15.5** |

### スコア根拠

**技術的実現性 (SA)**
- 案B (5): Preact + tsup 環境そのまま。dagre/d3-zoom は純粋な JS ライブラリで互換性問題なし
- 案C (3): Cytoscape の DOM 直接操作と Preact の仮想 DOM の競合リスク
- 案D (3): フレームワーク移行の技術的不確実性。tsup + esbuild での React バンドルは未検証

**ビジネス価値 (PM)**
- 案A (1): ユーザー課題未解決。ビューアーの存在意義が薄い
- 案B (4): 階層レイアウトで遷移全体像を一望。Phase 1 にドラッグ/ミニマップがないため4
- 案C (4): 機能豊富だが Canvas 描画により Tailwind との統一感が損なわれる
- 案D (5): React Flow はデファクト。Phase 2 の編集機能を最も豊かに実現できる

**工数・コスト (SA/PM 一致)**
- 案B (4): ~42KB 追加。既存スタックに自然統合、移行不要
- 案C (2): ~400KB 増 + Preact DOM統合の複雑さ + 学習コスト
- 案D (1): フレームワーク移行 + グラフ実装の二重タスク。Phase 1 デリバリー遅延

**保守性・拡張性 (SA:4 / PM:3)**
- 案B: SA は3層分離で独立テスト可能と評価 (4)。PM は SVG 自前管理のコストを指摘しつつ、描画層だけの差し替え可能性を評価 (3)
- 案D (SA:5 / PM:5): 両者一致。React エコシステムの長期的恩恵は最大

**リスク (SA:4 / PM:4 → 一致)**
- 案B: dagre は枯れたライブラリ。バンドル増軽微。Phase 2 の SVG 編集が唯一のリスク
- 案C (SA:2 / PM:2): DOM 競合、バンドルサイズが CLI ユーザーの期待と不整合
- 案D (SA:2 / PM:1): PM はフレームワーク移行 + バンドル増のリスクをより重く評価

### PM 追加提言: lazy loading

CLI ツールとして `tespec view` 以外のコマンドにグラフライブラリが影響しないよう、グラフ関連モジュールは **dynamic import で lazy loading** すべき（案B/C/D 共通）。これにより CLI 起動時間への影響をゼロにできる。

---

## 合意点

全チームメンバー（PM、SA）で以下が合意:

1. **案A は棄却**: グラフ可視化はユーザー価値として必須
2. **案B を Phase 1 の推奨案**: コスト対効果が最も高く、既存スタックとの整合性が最良
3. **Preact 維持**: Phase 1 で Preact → React 移行は不要
4. **3層分離アーキテクチャ**: データ変換 → レイアウト → 描画の分離を採用
5. **dagre (rankdir: TB)**: 上→下の階層レイアウト
6. **バンドルサイズ**: +13KB gzip は許容範囲内

## 対立点

なし。PM と SA で案B への合意が一致。

## 確定事項（ユーザー回答）

- **ダッシュボード配置**: 並列表示型（split view）— 既存サイドバー + グラフを同時表示

## 未決事項（Step 3 以降で決定）

1. **ノードの視覚的区別方法**: Screen/Setup の色・形・アイコン
3. **エッジの視覚的区別方法**: navigates_to/workflow/given の色・線種・ラベル
4. **ホバープレビューの内容**: case 一覧、route、title 等
5. **Phase 2 移行判定基準**: どの時点で React Flow への移行を再検討するか

## 推奨: 案B で Phase 1 実装を開始
