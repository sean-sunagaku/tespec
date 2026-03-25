# TODO: tespec CLI v1 実装

> 元のタスク: YAML で画面仕様（操作×期待値）を定義し、参照整合性チェック（validate）とテストスケルトン生成（generate）を行う TypeScript CLI ツールの v1 を実装する。
>
> 設計書: `.claude/arch-design/sessions/tespec-cli-architecture/step4-output/architecture.md`
> 仕様書: `docs/tespec-design.md`

## 進捗サマリー
- 総タスク数: 8
- 完了: 8
- レビュー済み: 8/8
- 最終更新: 2026-03-25 09:03 JST

## タスク一覧

| # | ディレクトリ | タスク | 状態 |
|---|------------|--------|------|
| 1 | `01-scaffold/` | プロジェクトスキャフォールド | [x] |
| 2 | `02-schema/` | core/schema.ts — Zod スキーマ + 型定義 | [x] |
| 3 | `03-parser/` | core/parser.ts — YAML パース | [x] |
| 4 | `04-validator/` | core/validator.ts — 参照整合性チェック | [x] |
| 5 | `05-generator/` | core/generator.ts — テストスケルトン生成 | [x] |
| 6 | `06-output/` | utils/output.ts — 出力ユーティリティ | [x] |
| 7 | `07-commands/` | commands/ + cli.ts — oclif コマンド実装 | [x] |
| 8 | `08-build/` | ビルド・動作確認・ドキュメント | [x] |

## 依存順序

```
01-scaffold → 02-schema → 03-parser → 04-validator
                                    → 05-generator
                       → 06-output
              07-commands（03,04,05,06 完了後）
              08-build（全て完了後）
```

## メモ
- 2026-03-24 21:01 JST: `01-scaffold` を開始。まず build 可能な最小構成を整えて、その後に独立モジュールを SubAgent に切り出す。
- 2026-03-24 21:06 JST: `01-scaffold` は build 成功で完了。`02 / 04 / 05 / 06` を SubAgent に並列委譲する。
- 2026-03-24 21:08 JST: main は `03-parser` に着手。fixture とユニットテストも同時に整備する。
- 2026-03-24 21:08 JST: `03-parser` は `npm test -- src/core/parser.test.ts` 成功で完了。
- 2026-03-25 09:03 JST: `07-commands` と `08-build` を main で完了。`npm test`、`npm run build`、`npx tespec validate --help`、`npx tespec generate --help`、サンプル YAML の `validate` / `generate --dry-run` を確認済み。
