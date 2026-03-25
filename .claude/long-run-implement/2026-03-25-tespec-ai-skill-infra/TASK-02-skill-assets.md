# TASK-02: Skill ルール生成と Skill 本体整備

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-25 13:03 JST

## Goal
- `src/core/schema.ts` から AI 向け参照ルールを自動生成するスクリプトと、`skills/tespec-yaml-gen/` の初期資産を整備する。

## Parent / Depends On
- Parent: `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/todo.md`
- Dependencies: なし

## Done When
- `scripts/generate-references.ts` が schema から `skills/tespec-yaml-gen/rules/*.md` を生成できる
- `skills/tespec-yaml-gen/SKILL.md` が設計に沿って整備されている
- 初回生成結果が repo に反映され、最低限の使い方と参照規則が記述されている

## Checklist
- [x] `scripts/generate-references.ts` を追加
- [x] `skills/tespec-yaml-gen/SKILL.md` を追加
- [x] `skills/tespec-yaml-gen/rules/*.md` を生成して保存
- [x] 生成スクリプトの実行結果を記録

## Progress Log
- 2026-03-25 12:55 JST: タスク作成。`scripts/` と `skills/` 配下を独立した書き込み範囲として切り出した。
- 2026-03-25 12:57 JST: worker `Linnaeus` に着手依頼。schema から rules 生成する script と `SKILL.md` の初期実装を進行中。
- 2026-03-25 13:01 JST: worker を停止し、main で task を引き取った。`scripts/generate-references.ts` と `skills/tespec-yaml-gen/SKILL.md` を追加。
- 2026-03-25 13:02 JST: generator の初期化順を修正し、`pnpm skill:sync` で `rules/*.md` の初回生成を確定した。

## Blockers
- None

## Verification
- 2026-03-25 13:02 JST
  - Type: automated test
  - Scope: Skill reference generation script
  - Command: `pnpm skill:sync`
  - Result: pass
  - Notes: `case-schema.md`, `screen-schema.md`, `setup-schema.md`, `validation-rules.md` を生成。

## Decision Log
- 2026-03-25 12:55 JST: Phase 1 では `src/skill/` を新設せず、`scripts/generate-references.ts` 単一ファイルで完結させる。
- 2026-03-25 13:01 JST: クロスリファレンス警告は JSON Schema だけでは表現できないため、`validation-rules.md` は script 内の固定テンプレートで生成する。

## Next Action
- None
