# TODO: tespec AI Skill インフラ Phase 1

> 元のタスク: `.claude/arch-design/sessions/tespec-ai-skill-infra` の設計に沿って、tespec YAML を AI が生成・検証しやすくする Phase 1 を実装する。
>
> 設計書: `.claude/arch-design/sessions/tespec-ai-skill-infra/step4-architecture.md`
> 参照ログ: `.claude/arch-design/sessions/tespec-ai-skill-infra/design_log.md`

## Status Summary
- 総タスク数: 6
- 完了: 6
- 実行中: 0
- ブロック中: 0
- 最終更新: 2026-03-25 13:25 JST

## Execution Order
1. `TASK-01` `validate --file` 対応
2. `TASK-02` Skill 資産生成
3. `TASK-03` workflow / package 連携
4. `TASK-04` YAML 例と項目説明の強化
5. `TASK-05` version 変更時の repo 内 `skills/` 更新
6. `TASK-06` generated writing guide / generated SKILL 化

## Tracker
| ID | Title | Status | Owner | Depends On | File | Notes |
|---|---|---|---|---|---|---|
| TASK-01 | `validate --file` 単体検証対応 | done | Kuhn + main | - | `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/TASK-01-validate-file.md` | export / flag / 統合テストを反映し、検証済み |
| TASK-02 | Skill ルール生成と Skill 本体整備 | done | main | - | `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/TASK-02-skill-assets.md` | generator / SKILL / rules 生成まで完了 |
| TASK-03 | package / CI workflow 連携と最終検証 | done | main | TASK-02 | `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/TASK-03-workflow-packaging.md` | `check:ci` / `test` / `build` 成功 |
| TASK-04 | YAML 例と各項目説明の拡充 | done | main | TASK-02 | `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/TASK-04-doc-enrichment.md` | rules と `SKILL.md` に YAML 例と説明文を反映済み |
| TASK-05 | version 変更時の repo 内 `skills/` 更新 | done | main | TASK-02, TASK-03 | `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/TASK-05-version-aware-sync.md` | generated rules に version を埋め込み、workflow が `package.json` も監視 |
| TASK-06 | generated writing guide / generated SKILL 化 | done | Galileo + main | TASK-02, TASK-05 | `.claude/long-run-implement/2026-03-25-tespec-ai-skill-infra/TASK-06-generated-writing-guide.md` | `writing-guide.md` と generated `SKILL.md` を追加し、自動同期対象へ拡張 |

## Active Blockers
- None

## Ready Queue
- None

## Done Log
- 2026-03-25 12:55 JST: 実装トラッカーを作成。`TASK-01` と `TASK-02` を並列化候補、`TASK-03` を統合作業として定義。
- 2026-03-25 12:57 JST: `GPT-5.4 xHigh` worker `Kuhn` を `TASK-01`、`Linnaeus` を `TASK-02` に割り当てて開始。
- 2026-03-25 12:58 JST: main が `TASK-03` に着手。`tsx` 追加と workflow のドラフトを進める。
- 2026-03-25 13:03 JST: `pnpm skill:sync`、`pnpm check:ci`、`pnpm test`、`pnpm build` がすべて成功。`TASK-01` から `TASK-03` を完了に更新。
- 2026-03-25 13:04 JST: 追加要望により `TASK-04` を開始。rules と `SKILL.md` に YAML 例と各項目説明を拡充する。
- 2026-03-25 13:07 JST: `TASK-04` を完了。`rules/*.md` に YAML 例と field description を追加し、`pnpm skill:sync` と `pnpm exec biome check ./scripts` の成功を確認。
- 2026-03-25 13:15 JST: `TASK-05` を完了。generated rules に tespec version を埋め込み、workflow の監視対象に `package.json` を追加した。
- 2026-03-25 13:21 JST: `TASK-06` を開始。変わりやすい writing guide を generated docs へ寄せ、`SKILL.md` の自動生成範囲を広げる。
- 2026-03-25 13:25 JST: `TASK-06` を完了。`rules/writing-guide.md` と generated `SKILL.md` を追加し、workflow が `skills/tespec-yaml-gen/` 全体を同期するよう更新。
