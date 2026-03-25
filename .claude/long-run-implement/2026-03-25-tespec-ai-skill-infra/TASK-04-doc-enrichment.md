# TASK-04: YAML 例と各項目説明の拡充

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-25 13:07 JST

## Goal
- Skill の rules と `SKILL.md` に、実際の YAML 例と各項目の意味説明を追加して、AI と人が読みやすい参照資料にする。

## Parent / Depends On
- Parent: `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/todo.md`
- Dependencies: `TASK-02`

## Done When
- `case-schema.md`, `screen-schema.md`, `setup-schema.md` に YAML 例が含まれている
- 各 field に「何を書くか」「何を参照するか」の説明が含まれている
- `SKILL.md` に YAML 記述方針の説明が追加されている
- 変更後の `pnpm skill:sync` が成功している

## Checklist
- [x] generator に YAML 例セクションを追加
- [x] 各 field の説明文を強化
- [x] `SKILL.md` に記述方針を追加
- [x] `pnpm skill:sync` を再実行して確認

## Progress Log
- 2026-03-25 13:04 JST: ユーザー要望を反映して task を追加。`scripts/generate-references.ts` と `skills/tespec-yaml-gen/` を再度更新する。
- 2026-03-25 13:06 JST: generator を schema ごとの固定 YAML サンプルと説明文マップ対応に拡張し、`validation-rules.md` にも参照例を追加。
- 2026-03-25 13:07 JST: `SKILL.md` に YAML 記述ガイドと setup 例を追加し、再生成と script lint を通して task を完了。

## Blockers
- None

## Verification
- 2026-03-25 13:06 JST
  - Type: automated test
  - Scope: enriched rules generation
  - Command: `pnpm skill:sync`
  - Result: pass
  - Notes: `screen-schema.md`, `case-schema.md`, `setup-schema.md`, `validation-rules.md` に YAML 例と項目説明が反映された。

- 2026-03-25 13:06 JST
  - Type: automated test
  - Scope: generator script formatting / lint
  - Command: `pnpm exec biome check ./scripts`
  - Result: pass
  - Notes: `scripts/generate-references.ts` の整形と構文チェックが成功。

## Decision Log
- 2026-03-25 13:04 JST: YAML 例は自動生成ではなく、schema ごとに意図が伝わる固定サンプルを持たせる。

## Next Action
- None
