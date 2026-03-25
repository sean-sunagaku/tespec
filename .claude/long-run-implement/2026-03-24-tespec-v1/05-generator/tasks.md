# 05: core/generator.ts — テストスケルトン生成

**状態**: [x] 完了
**概要**: Screen 定義から Playwright テストスケルトン文字列を生成する純粋関数。
**依存**: 02-schema 完了後（parser/validator とは独立してテスト可能）

## 実行メモ
- owner: subagent (`gpt-5.4 xhigh`)
- started: 2026-03-24 21:06 JST
- note: `src/core/generator.ts` と `src/core/generator.test.ts` のみを担当
- finished: 2026-03-25 09:03 JST
- verification: `npm test` 成功、`src/core/generator.test.ts` を含む全 27 テスト PASS

## タスク

- [ ] 5-1: generateTestFile(screen, setups) メイン関数を実装（src/core/generator.ts）
  - `import { test, expect } from "@playwright/test";` を先頭に
  - `test.describe(screen.title, () => { ... })` でラップ
  - cases を type 別にグルーピング:
    - type: 'normal' → トップレベルに test()
    - type: 'error' → `test.describe("異常系", ...)` 内に
    - type: 'boundary' → `test.describe("境界値", ...)` 内に
- [ ] 5-2: normal ケースの生成ロジック
  - テスト名: `"{action} → {expect}"` （expect が配列なら最初の要素）
  - given がある場合: setup の title をコメントで展開 `// Given: {setup.title}`
  - ボディ: `// TODO: implement`
- [ ] 5-3: error/boundary ケースの生成ロジック
  - given がある場合: `[{given}]` をテスト名のプレフィックスに
  - not_expect がある場合: `// not_expect: {値}` をコメントで追記
- [ ] 5-4: スナップショットテスト（src/core/generator.test.ts）
  - 正常系のみの Screen → toMatchSnapshot()
  - 正常系 + 異常系 + 境界値を含む Screen → toMatchSnapshot()
  - given が string / string[] のパターン
  - not_expect がある場合のコメント出力

## 完了条件
- `npm test -- src/core/generator.test.ts` が全テスト PASS
- 生成されたテストコードが Playwright の構文として正しい
