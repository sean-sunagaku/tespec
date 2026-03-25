# 06: utils/output.ts — 出力ユーティリティ

**状態**: [x] 完了
**概要**: picocolors を使った色付き出力関数4つ。シンプルなラッパー。
**依存**: 01-scaffold 完了後（いつでも着手可能）

## 実行メモ
- owner: subagent (`gpt-5.4 xhigh`)
- started: 2026-03-24 21:06 JST
- note: 既存の `src/utils/output.ts` をレビューし、必要なら最小修正する
- finished: 2026-03-25 09:03 JST
- verification: `tests/integration/validate.test.ts` と `tests/integration/generate.test.ts` で出力ユーティリティ経由の出力を確認

## タスク

- [ ] 6-1: 4つの出力関数を実装（src/utils/output.ts）
  - `printError(file: string, message: string): void`
    → `console.error(pc.red('ERROR:'), file + ':', message)` を stderr に
  - `printWarning(file: string, message: string): void`
    → `console.error(pc.yellow('WARN: '), file + ':', message)` を stderr に
  - `printOk(file: string): void`
    → `console.log(pc.green('OK:   '), file)` を stdout に
  - `printSuccess(message: string): void`
    → `console.log(pc.bold(pc.green(message)))` を stdout に

## 完了条件
- 4関数が export されている
- テストは不要（commands/ の統合テストでカバー）
