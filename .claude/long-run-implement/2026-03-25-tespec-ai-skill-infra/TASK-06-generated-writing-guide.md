# TASK-06: generated writing guide / generated SKILL 化

## Status
- Status: done
- Owner: Galileo
- Last Updated: 2026-03-25 13:25 JST

## Goal
- 変わりやすい YAML 記述ガイドを generated docs 側へ移し、`SKILL.md` も generator 管理に寄せる。

## Parent / Depends On
- Parent: `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/todo.md`
- Dependencies: `TASK-02`, `TASK-05`

## Done When
- `rules/writing-guide.md` のような generated writing guide が追加されている
- `SKILL.md` の変わりやすい説明が generated docs 参照中心に整理されている
- 可能なら `SKILL.md` 自体も generator から出力される
- workflow の diff / add 対象が generated `SKILL.md` を含められる形になっている

## Checklist
- [x] generator の出力対象を見直す
- [x] writing guide を generated doc に移す
- [x] `SKILL.md` の管理方式を generator 寄りに更新する
- [x] `pnpm skill:sync` と必要な check を通す

## Progress Log
- 2026-03-25 13:21 JST: ユーザー要望を反映して task を追加。手書き `SKILL.md` の変わりやすい節を generated docs へ寄せる。
- 2026-03-25 13:23 JST: `rules/writing-guide.md` を generator 出力に追加し、`SKILL.md` も generated wrapper として `rules/` を参照する構成に変更。
- 2026-03-25 13:24 JST: workflow の diff / add 対象を `skills/tespec-yaml-gen/` 全体へ広げ、generated `SKILL.md` も自動更新に含めた。
- 2026-03-25 13:25 JST: `scripts/generate-references.ts` 自体の変更でも workflow が走るように trigger path を追加した。
- 2026-03-25 13:25 JST: `pnpm skill:sync` と `pnpm exec biome check ./scripts` の成功を確認して task を完了。
- 2026-03-25 13:21 JST: worker `Galileo` に着手依頼。`rules/writing-guide.md` と generated `SKILL.md` の是非を含めて最小変更案を実装する。

## Blockers
- None

## Verification
- 2026-03-25 13:24 JST
  - Type: automated test
  - Scope: generated skill docs refresh
  - Command: `pnpm skill:sync`
  - Result: pass
  - Notes: `skills/tespec-yaml-gen/SKILL.md` と `rules/writing-guide.md` を含む generated docs が更新された。

- 2026-03-25 13:24 JST
  - Type: automated test
  - Scope: generator script formatting / lint
  - Command: `pnpm exec biome check ./scripts`
  - Result: pass
  - Notes: `scripts/generate-references.ts` の整形と構文チェックが成功。

## Decision Log
- 2026-03-25 13:21 JST: `rules/*.md` だけでなく、`SKILL.md` も generator 寄りにしたほうが version / guide 変更との同期ズレを減らせる。

## Next Action
- None
