# TASK-05: version 変更時の repo 内 `skills/` 更新

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-25 13:15 JST

## Goal
- `package.json` の version が変わったときに、repo 直下の `skills/` 生成物も更新されるようにする。

## Parent / Depends On
- Parent: `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/todo.md`
- Dependencies: `TASK-02`, `TASK-03`

## Done When
- generated rules に current package version が出力される
- `sync-references.yml` が `package.json` 変更でも動く
- `pnpm skill:sync` が成功する

## Checklist
- [x] generator が package version を読み取る
- [x] generated rules に version を埋め込む
- [x] workflow の監視対象に `package.json` を追加する
- [x] `pnpm skill:sync` と script check を確認する

## Progress Log
- 2026-03-25 13:10 JST: ユーザー要望を repo 内 `skills/` のみ対象と解釈し、外部 install は行わない方針に固定。
- 2026-03-25 13:12 JST: `scripts/generate-references.ts` が `package.json` から version を読み、generated rules の先頭に `tespec vX.Y.Z` を出すように変更。
- 2026-03-25 13:15 JST: `.github/workflows/sync-references.yml` の監視対象に `package.json` を追加し、再生成と script check を成功で確認。

## Blockers
- None

## Verification
- 2026-03-25 13:12 JST
  - Type: automated test
  - Scope: version-aware rules generation
  - Command: `pnpm skill:sync`
  - Result: pass
  - Notes: `skills/tespec-yaml-gen/rules/*.md` に tespec version が反映された。

- 2026-03-25 13:12 JST
  - Type: automated test
  - Scope: generator script formatting / lint
  - Command: `pnpm exec biome check ./scripts`
  - Result: pass
  - Notes: version 読み込み追加後も script check は成功。

## Decision Log
- 2026-03-25 13:10 JST: 「更新」は repo 直下の `skills/` のみを意味すると解釈し、`~/.claude/skills` など外部パスの install は scope 外にした。
- 2026-03-25 13:11 JST: version 変更時に diff を確実に作るため、workflow の trigger だけでなく generated rules 自体にも version を埋め込む。

## Next Action
- None
