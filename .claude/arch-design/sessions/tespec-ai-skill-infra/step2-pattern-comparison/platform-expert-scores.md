# platform-expert スタック適合性スコア

## 評価軸（各 1-3 点、合計 15 点満点）

| 軸 | 内容 | 3点 | 2点 | 1点 |
|---|---|---|---|---|
| A | 依存追加コスト | 追加ゼロ | devDep 1つ追加 | 複数追加 |
| B | Node.js >=18 互換性 | 完全互換 | 条件付き互換 | 非互換 |
| C | tsup 整合性 | 影響なし | 軽微な変更 | 要変更 |
| D | GitHub Actions 実装コスト | 低（シンプル） | 中 | 高（複雑） |
| E | ESM 互換性 | `"type":"module"` と完全整合 | 注意が必要 | 非互換 |

## スコア表

| Pattern | 概要 | A | B | C | D | E | 合計 | 判定 |
|---------|------|---|---|---|---|---|------|------|
| 1 | .mjs + schema-meta.mjs（二重管理） | 3 | 3 | 3 | 3 | 3 | 15 | △ スタック適合は高いが設計問題あり |
| 2 | .mjs + schema-meta.json | 3 | 3 | 3 | 3 | 3 | 15 | △ スタック適合は高いが JSON 手動更新運用 |
| 3 | tsx + Zod .shape | 2 | 3 | 3 | 2 | 3 | 13 | △ tsx 追加、.shape は toJSONSchema で代替可能 |
| 4 | tsx + .describe() 埋め込み | 2 | 3 | 2 | 2 | 3 | 12 | ✗ tsx 追加 + schema.ts 変更（SRP 問題） |
| 5 | .mjs + dist 経由 .shape | 3 | 3 | 2 | 3 | 3 | 14 | △ build 前提、.mjs→dist import 経路が複雑 |
| 6 | .claude/skills/ 直置き | — | — | — | — | — | ✗ **除外**（Claude Code が標準認識しない） |
| 7 | tsx + ts-morph AST パース | 1 | 3 | 3 | 2 | 3 | 12 | ✗ tsx + ts-morph 2依存追加、過剰 |
| 8 | .mjs + schema-meta.ts ビルド経由 | 3 | 3 | 2 | 3 | 3 | 14 | △ build 前提、tsup entry 追加必要 |
| 9 | tsx + gh pr create（差分チェックなし） | 2 | 3 | 3 | 3 | 3 | 14 | ○ tsx 追加のみ、冪等性なし |
| 10 | tsx + gh pr create + 差分チェック | 2 | 3 | 3 | 3 | 3 | 14 | ◎ tsx 追加のみ、冪等性あり |

## Pattern 6 除外の根拠（調査済み）

Claude Code のスキルインストールパス:
- 標準インストール先: `~/.claude/plugins/cache/<marketplace>/<skill>/<version>/`
- project scope プラグインも実体は `~/.claude/plugins/cache/` 以下
- プロジェクトローカルの `.claude/skills/` はどのスコープでも **標準認識されない**

唯一の回避策 `claude --plugin-dir ./.claude/skills/` はセッション限定で実用的でない。

## Zod v4 `.shape` API の評価

`.shape` は `v4/classic/schemas.d.ts` の公開プロパティ（`shape: Shape`）として型定義に存在する。
ただし `z.toJSONSchema()` が同じ情報を全て出力するため、`.shape` を使う理由がない。

- Pattern 3/5 の `.shape` 利用は `toJSONSchema()` で完全代替可能
- `toJSONSchema()` は Zod 公式の変換 API であり抽象度が高く安定

## Pattern 10 推奨根拠

1. `gh pr create` は ubuntu-latest に **組み込み済み**（追加 Action 不要）
2. `GITHUB_TOKEN` は GitHub Actions デフォルト提供（secrets 追加設定不要）
3. tsx は `pnpm add -D tsx` 1コマンド、ビルド成果物に含まれない
4. 差分チェックにより「schema.ts 変更なしに workflow が誤作動する」問題を防止
5. TypeScript で書けるため `src/core/schema.ts` を直接 import でき、型安全性が保たれる

## Pattern 2 vs Pattern 10 技術的差分

| 観点 | Pattern 2 | Pattern 10 |
|---|---|---|
| ランタイム | .mjs（純粋 JS） | tsx（TypeScript） |
| Zod import 方法 | `node_modules/zod` から直接 | `src/core/schema.ts` を直接 import |
| 型安全性 | なし | あり |
| schema 変更時の対応 | JSON 手動更新が必要（二重管理リスク） | 自動（schema.ts から直接生成） |
| devDep 追加 | ゼロ | tsx 1つ |
| 冪等性 | なし | あり（差分チェック） |
| 自動更新の信頼性 | 低（手動手順が残る） | 高（完全自動） |
