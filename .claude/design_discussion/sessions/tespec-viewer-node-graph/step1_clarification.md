# Step 1: Design Clarification - 完了

## テーマ
tespec view ノードグラフ可視化 (Phase 1: 読み取り専用)

## ユーザー要件（確認済み）

| 項目 | 回答 |
|------|------|
| Phase 1 スコープ | 読み取り専用の可視化。編集・YAML書き戻しは Phase 2 |
| 表示データ | 全データ: 画面遷移 (navigates_to), Workflow フロー, Setup 参照 |
| スケール | 50+ screens |
| インタラクション | ズーム/パン + ホバープレビュー + エッジラベル（リッチ/インタラクティブ） |

## 技術スタック決定

### ライブラリ選定

| 候補 | サイズ | 判定 | 理由 |
|------|--------|------|------|
| React Flow | ~300KB | 却下 | useSyncExternalStore/useId が Preact 非互換リスク |
| Cytoscape.js | ~85KB | 却下 | Preact との間接的統合 |
| D3-force | ~30KB | 却下 | Force-directed は DAG に不向き |
| elkjs | ~150KB | 保留 | 高品質だがオーバースペック、computeLayout() 分離で将来スワップ可能 |
| **dagre** | **~30KB** | **採用** | 階層レイアウト、DAG 最適、軽量 |
| **d3-zoom** | **~12KB** | **採用** | SVG ズーム/パン抽象化（ホイール、ピンチ、ドラッグ） |

**合計追加バンドル: ~42KB**

### レンダリング方式
- **Preact SVG コンポーネント** でノード・エッジを描画
- **HTML オーバーレイ** でホバープレビュー（ツールチップ）
- 50-100 ノード ≒ ~200 SVG 要素 → SVG パフォーマンス問題なし（数千要素まで対応可能）

## アーキテクチャ決定

### 3層アーキテクチャ

```
graph-utils.ts (純粋関数)
  ParsedProject → GraphData 変換 + 孤立ノード/サイクル検出
      ↓
compute-layout.ts (dagre 分離)
  GraphData → PositionedGraph (座標付き)
      ↓
GraphCanvas.tsx (SVG 描画 + d3-zoom)
  PositionedGraph → SVG レンダリング
```

### ファイル構成

```
src/core/viewer/
  components/
    graph/
      GraphView.tsx        -- メインコンテナ (フィルターUI + SVG)
      GraphCanvas.tsx       -- SVG 描画 + d3-zoom
      GraphNode.tsx         -- ノード描画
      GraphEdge.tsx         -- エッジ描画
      GraphTooltip.tsx      -- ホバープレビュー
      graph-types.ts        -- 型定義
  graph-utils.ts            -- ParsedProject → GraphData 変換
  compute-layout.ts         -- dagre レイアウト計算 (エンジンスワップ用分離)
```

### 統合ポイント
- `client-entry.tsx` の View 型に `{ type: 'graph' }` を追加
- 既存の `navigate(type, id)` 関数でグラフノードクリック→詳細遷移

### dagre 設定
- `rankdir: 'LR'` (左→右レイアウト)
- `nodesep: 60`
- `ranksep: 120`

## デザイン決定

### ノードデザイン

| ノード種別 | サイズ | スタイル |
|-----------|--------|---------|
| Screen | 200x80 | 青系 |
| Setup | 160x60 | グレー破線 |
| 孤立ノード | - | 赤枠 |

### エッジデザイン

| エッジ種別 | スタイル |
|-----------|---------|
| navigates_to (画面遷移) | 青 2px 実線 |
| workflow_step (ワークフロー) | 緑 3px 実線 |
| given (Setup参照) | グレー破線 1.5px |

### フィルターUI
- デフォルト: 画面遷移のみ表示
- トグル: Workflow フロー / Setup 参照 の ON/OFF

### エッジの特殊ケース
- **同一ノード間の複数エッジ**: curveOffset で 2本目以降をオフセット
- **循環参照**: dagre が自動処理（一時的エッジ反転）。バックエッジは右→左アークで描画

## Phase 2 方針
- React 移行 or SVG 拡張は Phase 1 安定後に判断
- computeLayout() の分離により elkjs へのスワップは 1日以内
- Phase 2 で必要な場合 POST /api/update をサーバーに追加
