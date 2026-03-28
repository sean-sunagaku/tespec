# Discussion Log: tespec viewer ノードグラフ可視化

## セッション情報
- テーマ: tespec view ノードグラフ可視化 + 将来編集機能のアーキテクチャ設計
- モード: Standard
- 開始日: 2026-03-27

---

## Step 1: Design Clarification

### ユーザー要件確認
- Phase 1: 読み取り専用可視化（編集は Phase 2）
- 表示対象: 全データ（navigates_to, Workflow, Setup）
- スケール: 50+ screens
- インタラクション: ズーム/パン + ホバープレビュー + エッジラベル

### 主要議論

#### 1. ライブラリ選定 (React Flow vs dagre)
- **PM**: React Flow を Phase 2 拡張性のため推奨
- **Engineer**: React Flow の useSyncExternalStore/useId が Preact 非互換リスク指摘
- **SA 判断**: dagre (~30KB) + d3-zoom (~12KB) を採用。React Flow (300KB) は Preact 互換リスクが高い

#### 2. dagre vs elkjs
- **Engineer**: 50+ screens で elkjs のエッジルーティングが優位と提案
- **SA 判断**: dagre を採用、computeLayout() 分離で将来 elkjs スワップ可能（YAGNI 原則）

#### 3. ズーム/パン実装
- **PM/Engineer**: 自前実装は 5-7 日のコスト懸念
- **Engineer**: d3-zoom (~8KB) を妥協案として提案
- **SA 判断**: d3-zoom 採用、実装コスト 1 日に短縮

#### 4. アーキテクチャ
- 3層分離: データ変換 → レイアウト計算 → SVG 描画
- 全チーム合意

### 結果
- 全項目合意済み → Step 1 完了
- 詳細は `step1_clarification.md` 参照

---
