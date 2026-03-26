# TASK-01: Core Unit Parse And Validate

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-26 11:21

## Goal
- `step4-architecture.md` に沿って Unit Spec の schema, parser, validator, validate command を実装する。

## Parent / Depends On
- Parent: `.claude/arch-design/sessions/unit-spec-extension/tasks/index.md`
- Dependencies: None

## Done When
- `schema.ts` に Unit 系スキーマと `units_dir` が追加されている
- `parser.ts` が Unit YAML をオプショナルに読み込める
- `unit-validator.ts` が新設され、validate command が Unit を扱える
- Core まわりの unit test が追加または更新されている

## Checklist
- [x] Unit schema と型を追加する
- [x] parser に `units` 読み込みを追加する
- [x] `unit-validator.ts` を新設する
- [x] `validate.ts` を Unit 対応に拡張する
- [x] 関連 unit test を追加または更新する

## Progress Log
- 2026-03-26 11:14: Task created. Ownership assigned to core-worker.
- 2026-03-26 11:14: Ownership handed to SubAgent `Poincare`.
- 2026-03-26 11:16: Added Unit schema/types, parser support, `unit-validator.ts`, and `validate --file` support for Unit YAML.
- 2026-03-26 11:17: Added dedicated parser fixtures under `tests/fixtures/unit-parse-*`.
- 2026-03-26 11:18: Focused core tests and validate integration tests passed; task completed.

## Blockers
- None

## Verification
- 2026-03-26 11:18
  - Type: automated test
  - Scope: core schema/parser/unit validation and validate command compatibility
  - Command: `pnpm vitest run src/core/__test__/schema.test.ts src/core/__test__/parser.test.ts src/core/__test__/unit-validator.test.ts` and `pnpm vitest run tests/integration/validate.test.ts`
  - Result: pass
  - Notes: Verified Unit schema parsing, optional `units_dir`, dedicated unit validation, and single-file Unit validation paths.

## Decision Log
- 2026-03-26 11:14: Write scope is limited to core parsing/validation files and their direct unit tests to avoid overlap with generator work.
- 2026-03-26 11:16: Added dedicated `unit-parse-*` fixtures instead of mutating shared fixtures to keep integration coverage isolated.

## Next Action
- None.
