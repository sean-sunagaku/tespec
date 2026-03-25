# TASK-03: package / CI workflow 連携と最終検証

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-25 13:03 JST

## Goal
- Skill 同期スクリプトを package / lockfile / GitHub Actions に接続し、Phase 1 全体を横断検証できる状態にする。

## Parent / Depends On
- Parent: `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/todo.md`
- Dependencies: `TASK-02`

## Done When
- `package.json` に `tsx` と `skill:sync` が追加されている
- lockfile が更新されている
- `.github/workflows/sync-references.yml` が追加され、差分があるときだけ PR を作る
- `pnpm test`, `pnpm build`, `pnpm skill:sync` など必要な確認結果が記録されている

## Checklist
- [x] `package.json` と lockfile を更新
- [x] `sync-references.yml` を追加
- [x] Phase 1 の横断検証を実施
- [x] 追跡ファイルに結果を反映

## Progress Log
- 2026-03-25 12:55 JST: タスク作成。`package.json`, `pnpm-lock.yaml`, `.github/workflows/` と横断検証を main 側の統合作業として保持。
- 2026-03-25 12:58 JST: main が先行着手。`TASK-02` の script パス前提は設計書で固定されているため、package / workflow の整備は先に進める。
- 2026-03-25 13:01 JST: `package.json` に `skill:sync` を追加し、`.github/workflows/sync-references.yml` を作成。`tsx` はすでに devDependency と lockfile に反映済みだったためその変更を採用した。
- 2026-03-25 13:03 JST: `tests/integration/command-test-utils.ts` で oclif のノイズ warning を除外し、`check:ci` / `test` / `build` をすべて成功させた。

## Blockers
- None

## Verification
- 2026-03-25 13:02 JST
  - Type: automated test
  - Scope: skill generator wiring
  - Command: `pnpm skill:sync`
  - Result: pass
  - Notes: `tsx` 経由で `scripts/generate-references.ts` が実行された。

- 2026-03-25 13:03 JST
  - Type: automated test
  - Scope: CI-equivalent lint / format check
  - Command: `pnpm check:ci`
  - Result: pass
  - Notes: `src` / `tests` の Biome check が成功。

- 2026-03-25 13:03 JST
  - Type: automated test
  - Scope: full test suite
  - Command: `pnpm test`
  - Result: pass
  - Notes: 34 tests passed。

- 2026-03-25 13:03 JST
  - Type: automated test
  - Scope: package build
  - Command: `pnpm build`
  - Result: pass
  - Notes: tsup build と DTS build が成功。

## Decision Log
- 2026-03-25 12:55 JST: workflow は設計書どおり `gh pr create` と `git diff --exit-code` を使って冪等性を確保する。

## Next Action
- None
