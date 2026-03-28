# Step 1: 課題・要件の明確化

## 設計テーマ
tespec view のブラウザビューアーに画面遷移のノードグラフ可視化を追加

## 確定した要件

### Phase 分離
- **Phase 1**: Read-only（閲覧のみ）のノードグラフ表示
- **Phase 2**: ノード上での編集 → YAML 書き戻し

### 表示データ
- Screen 間の遷移（`Case.navigates_to`）
- Workflow のステップフロー（`Workflow.steps[].screen`）
- Setup の参照関係（`Case.given`）

### 操作体験
- インタラクティブ: ズーム/パン + ホバーで情報プレビュー + エッジにラベル表示

### 想定規模
- 50画面以上を想定

### 統合方法
- 既存 tespec view のダッシュボードに埋め込み

### レイアウト方向
- 上→下の階層レイアウト（dagre の rankdir: TB）

## 技術的制約

### 現在のアーキテクチャ
- Preact 10.29 + Hono（サーバー）
- tsup (esbuild ベース) でバンドル
- Tailwind CSS (CDN)
- SSE + `/api/specs` でリアルタイム更新

### ライブラリ互換性
- React Flow (@xyflow/react) は React 17+ 前提。`useSyncExternalStore` 等の互換性リスクあり
- preact/compat で動く保証なし（バンドルサイズ ~300KB も懸念）

### チーム合意事項（Step 1 時点）
- dagre (~30KB) + d3-zoom (~12KB) を基本方針とする
- 3層分離アーキテクチャ: データ変換 → レイアウト計算 → SVG 描画
- Preact のまま進める（React 移行は Phase 2 で再検討）

## Step 2 で決定すべき事項
1. 具体的な設計案の比較（dagre+SVG vs Cytoscape.js vs React移行+React Flow）
2. ダッシュボードへの埋め込み方法（レイアウト設計）
3. ノードタイプ（Screen/Setup）とエッジタイプ（navigates_to/workflow/given）の視覚的な区別方法
4. Phase 2 を見据えたデータフロー設計
