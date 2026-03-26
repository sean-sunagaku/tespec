# TASK-03: Integration Fixtures And Verification

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-26 11:21

## Goal
- Core と generator の変更を統合し、fixtures と integration test を整え、最終検証を完了する。

## Parent / Depends On
- Parent: `.claude/arch-design/sessions/unit-spec-extension/tasks/index.md`
- Dependencies: TASK-01, TASK-02

## Done When
- Unit 用 fixture が追加されている
- `tests/integration` が Unit validate/generate をカバーしている
- 必要な test/lint/build が通るか、未実施理由が明記されている

## Checklist
- [x] SubAgent の変更を統合する
- [x] Unit fixture を追加する
- [x] integration test を追加または更新する
- [x] 必要な検証を実行して結果を記録する

## Progress Log
- 2026-03-26 11:14: Task created. Main agent will handle integration and final verification after worker results land.
- 2026-03-26 11:14: Began planning dedicated integration fixtures for Screen + Unit mixed generation and validation paths.
- 2026-03-26 11:15: Added dedicated integration fixtures for command-unit-ok, command-unit-warning, command-unit-error, and invalid-unit-schema.
- 2026-03-26 11:16: Added `command-unit-multi` fixture to verify `generate --unit` filtering independently from screen generation.
- 2026-03-26 11:16: Expanded integration tests for `validate` and `generate` to cover Unit parsing, warnings, duplicate IDs, separate unit targets, and `--unit` filtering.
- 2026-03-26 11:21: Verified full repository test, lint, and build passes; task completed.

## Blockers
- None

## Verification
- 2026-03-26 11:21
  - Type: automated test
  - Scope: full repository verification for Unit Spec extension
  - Command: `pnpm test`, `pnpm run check:ci`, `pnpm build`
  - Result: pass
  - Notes: All 61 tests passed; Biome check and tsup build succeeded after integrating sample docs and fixtures.

## Decision Log
- 2026-03-26 11:14: Integration fixtures are kept for the main agent to avoid write conflicts across worker tasks.
- 2026-03-26 11:15: Added sample `docs/tespec/units/` and updated sample config so the repository shows the new Unit workflow end-to-end.

## Next Action
- None.
