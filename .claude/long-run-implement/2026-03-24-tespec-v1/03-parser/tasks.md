# 03: core/parser.ts — YAML パース

**状態**: [x] 完了
**概要**: config.yaml を起点に screens/*.yaml と setups/*.yaml を読み込み、Zod で構造検証して型付きオブジェクトを返す。エラーは全件収集（1件で止めない）。
**依存**: 02-schema 完了後

## 実行メモ
- owner: main
- started: 2026-03-24 21:08 JST
- note: `src/core/parser.ts`、`src/core/parser.test.ts`、`tests/fixtures/**` をまとめて実装する
- finished: 2026-03-24 21:08 JST
- verification: `npm test -- src/core/parser.test.ts` 成功（5 tests passed）

## タスク

- [ ] 3-1: ParsedProject と ParseError の型を定義（src/core/parser.ts）
  - ParsedProject: { config: Config, screens: Screen[], setups: Setup[] }
  - ParseError: { file: string, message: string }
- [ ] 3-2: parseProject(configPath) メイン関数を実装（src/core/parser.ts）
  - config.yaml 読み込み → ConfigSchema.parse()
  - config.screens_dir の全 .yaml を glob → 各 ScreenSchema.parse()
  - config.setups_dir の全 .yaml を glob → 各 SetupSchema.parse()
  - 返り値: { result?: ParsedProject, errors: ParseError[] }
- [ ] 3-3: エラーハンドリング（src/core/parser.ts）
  - yaml ライブラリの ParseError → ファイル名 + 行番号付きメッセージ
  - Zod の ZodError → フィールド名 + 期待される型のメッセージ
  - ファイル未発見 → ファイルパス付きエラーメッセージ
  - **1ファイルのエラーで処理を止めない**（全件収集）
- [ ] 3-4: テスト用 fixture を作成（tests/fixtures/）
  - valid/: 正常な config.yaml + screens/login.yaml + screens/home.yaml + setups/auth.yaml
  - invalid-schema/: 必須フィールド（action）が欠落した screen YAML
  - invalid-yaml/: YAML 構文エラー（インデント不正等）
  - empty-screens/: screens ディレクトリが空
  - missing-dir/: screens_dir が存在しない config
- [ ] 3-5: ユニットテスト（src/core/parser.test.ts）
  - 正常パース（全フィールドあり / 最小フィールドのみ）
  - 複数ファイルにエラーがある場合の全件収集確認
  - 存在しないディレクトリのエラー
  - 空ディレクトリでの挙動（screens 0件は OK、エラーではない）

## 完了条件
- `npm test -- src/core/parser.test.ts` が全テスト PASS
- fixture の正常 YAML がパースできる
- エラーが全件収集されている（複数エラー fixture で確認）
