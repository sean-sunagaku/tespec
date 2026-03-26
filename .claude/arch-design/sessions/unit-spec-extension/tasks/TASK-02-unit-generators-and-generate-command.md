# TASK-02: Unit Generators And Generate Command

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-26 11:21

## Goal
- `step4-architecture.md` に沿って generator split, unit generators, registry/types rename, generate command 拡張を実装する。

## Parent / Depends On
- Parent: `.claude/arch-design/sessions/unit-spec-extension/tasks/index.md`
- Dependencies: None

## Done When
- `generators/` が `screen/` と `unit/` に分かれている
- Screen/Unit generator interfaces と registries が分離されている
- `generate.ts` が `--unit-target` と `--unit` を扱える
- Generator まわりの unit test が追加または更新されている

## Checklist
- [x] Screen generator ファイルを `screen/` 配下へ移動する
- [x] Unit generator 2種を追加する
- [x] `types.ts` と `registry.ts` を新構成へ更新する
- [x] `generate.ts` を Screen + Unit 生成対応に拡張する
- [x] 関連 generator test を追加または更新する

## Progress Log
- 2026-03-26 11:14: Task created. Ownership assigned to generator-worker.
- 2026-03-26 11:14: Ownership handed to SubAgent `Schrodinger`.
- 2026-03-26 11:19: Split screen generators into `screen/`, added Unit generators under `unit/`, and updated registry/type separation.
- 2026-03-26 11:20: Extended `generate.ts` with `--unit-target` and `--unit`, and added generator unit tests for Vitest and XCTest outputs.
- 2026-03-26 11:21: Focused generator tests passed; task completed.

## Blockers
- None

## Verification
- 2026-03-26 11:21
  - Type: automated test
  - Scope: screen/unit generators and generate command output paths
  - Command: `pnpm vitest run src/core/__test__/generator.test.ts src/core/__test__/generator-xctest.test.ts src/core/__test__/generator-vitest.test.ts src/core/__test__/generator-unit-xctest.test.ts` and `pnpm vitest run tests/integration/generate.test.ts`
  - Result: pass
  - Notes: Verified moved screen generators, new Unit generator outputs, separate unit target selection, and unit filtering in CLI.

## Decision Log
- 2026-03-26 11:14: Write scope excludes integration fixtures and validate command to keep parallel edits independent.
- 2026-03-26 11:19: Kept Screen and Unit generator implementations separate rather than abstracting shared rendering logic, matching ADR-4 and ADR-10.

## Next Action
- None.
