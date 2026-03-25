# TASK-01: `validate --file` 単体検証対応

## Status
- Status: done
- Owner: Kuhn + main
- Last Updated: 2026-03-25 13:03 JST

## Goal
- `tespec validate --file <path>` で `config.yaml` なしに screen または setup YAML を単体検証できるようにする。

## Parent / Depends On
- Parent: `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/todo.md`
- Dependencies: なし

## Done When
- `src/core/parser.ts` の `ParsedFileResult<T>` と `parseYamlFile()` が export されている
- `src/commands/validate.ts` に `--file` フラグが追加され、screen / setup の両方を単体検証できる
- `tests/integration/validate.test.ts` に `--file` の成功・失敗ケースが追加されている

## Checklist
- [x] `parser.ts` の export 追加
- [x] `validate.ts` に `--file` フラグと分岐を実装
- [x] `validate` 統合テストを追加
- [x] 対象テストを実行して結果を記録

## Progress Log
- 2026-03-25 12:55 JST: タスク作成。`parser.ts`, `validate.ts`, `tests/integration/validate.test.ts` を主な書き込み範囲として定義。
- 2026-03-25 12:57 JST: worker `Kuhn` に着手依頼。`--config` 互換維持を前提に `--file` 分岐と統合テスト追加を実装中。
- 2026-03-25 13:01 JST: main で `parseYamlFile` export、`validate --file`、`--file` 統合テスト 4 件を実装。
- 2026-03-25 13:03 JST: oclif のノイズ warning をテストヘルパーで無視するように調整し、対象テストと全体テストの成功を確認して完了。

## Blockers
- None

## Verification
- 2026-03-25 13:02 JST
  - Type: automated test
  - Scope: `validate` command integration tests
  - Command: `pnpm exec vitest run tests/integration/validate.test.ts`
  - Result: pass
  - Notes: 7 tests passed。screen / setup / invalid schema / flag conflict を確認。

- 2026-03-25 13:03 JST
  - Type: automated test
  - Scope: validate 変更を含む全テスト
  - Command: `pnpm test`
  - Result: pass
  - Notes: 34 tests passed。

## Decision Log
- 2026-03-25 12:55 JST: `--file` は設計書の E2 に従い `parseYamlFile()` を直接呼ぶ方式で実装する。
- 2026-03-25 13:02 JST: 単一ファイル検証の失敗時は YAML / file read error を優先し、それ以外は `setups/` 配下かどうかで screen / setup のエラー表示を切り替える。

## Next Action
- None
