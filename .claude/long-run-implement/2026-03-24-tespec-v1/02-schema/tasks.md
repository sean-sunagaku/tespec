# 02: core/schema.ts — Zod スキーマ + 型定義

**状態**: [x] 完了
**概要**: YAML 仕様の全フィールドを Zod スキーマで定義し、TypeScript 型をエクスポートする。全モジュールの基盤。
**依存**: 01-scaffold 完了後

## 実行メモ
- owner: subagent (`gpt-5.4 xhigh`)
- started: 2026-03-24 21:06 JST
- note: 既存の `src/core/schema.ts` と `src/core/schema.test.ts` をレビューしつつ要件差分を埋める
- finished: 2026-03-25 09:03 JST
- verification: `npm test` 成功、`src/core/schema.test.ts` を含む全 27 テスト PASS

## タスク

- [ ] 2-1: CaseSchema を定義（src/core/schema.ts）
  - action: z.string() — 必須
  - expect: z.union([z.string(), z.array(z.string())]) — 必須
  - given: z.union([z.string(), z.array(z.string())]).optional()
  - target: z.string().optional()
  - type: z.enum(['normal', 'error', 'boundary']).default('normal')
  - not_expect: z.array(z.string()).optional()
  - navigates_to: z.string().optional()
- [ ] 2-2: ScreenSchema を定義（src/core/schema.ts）
  - screen: z.string(), route: z.string(), title: z.string(), cases: z.array(CaseSchema)
- [ ] 2-3: SetupSchema を定義（src/core/schema.ts）
  - setup: z.string(), title: z.string(), steps: z.array(z.string())
- [ ] 2-4: ConfigSchema を定義（src/core/schema.ts）
  - version: z.number(), project: z.string()
  - screens_dir: z.string().default('./screens'), setups_dir: z.string().default('./setups')
- [ ] 2-5: 全スキーマから z.infer で型をエクスポート
  - export type Case, Screen, Setup, Config
- [ ] 2-6: ユニットテスト（src/core/schema.test.ts）
  - 必須フィールド欠落でエラー
  - type デフォルト値 'normal' の補完
  - given/expect の string | string[] 両形式
  - 不正な type 値（例: 'invalid'）の拒否

## 完了条件
- `npm test -- src/core/schema.test.ts` が全テスト PASS
- 4つのスキーマと4つの型が正しくエクスポートされている
