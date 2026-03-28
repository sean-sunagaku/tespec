# Workflow Schema

> Generated from `src/core/schema.ts` by `scripts/generate-references.ts` for tespec v0.1.0.

workflows/*.yaml の 1 ワークフロー定義を表します。
複数画面をまたぐユーザーシナリオ（E2E テスト相当）を定義します。

## YAML Example
```yaml
workflow: user-registration
title: 新規ユーザー登録フロー
steps:
  - screen: landing
    action: 新規登録ボタンをクリックする
    expect: 登録フォームが表示される
  - screen: register
    action: 必要事項を入力して送信する
    expect: 確認メールの案内が表示される
  - screen: email-verify
    action: メール内のリンクをクリックする
    expect: ダッシュボードに遷移する
  - screen: dashboard
```

## Root Rules
- Type: `object`
- Additional properties: `not allowed`

## Field Guide
- `workflow` (required): `string`
  - Description: ワークフローを識別する一意 ID です。短く安定した名前にします。
- `title` (required): `string`
  - Description: 人が読むワークフロー名です。生成される `test.describe()` のタイトルとして使われます。
- `steps` (required): `array<object>`
  - Description: ワークフローの各ステップです。画面を順番に辿るシナリオを記述します。
  - Constraint: array length must be at least `1`.
- `steps[].screen` (required): `string`
  - Description: このステップで表示される画面の screen ID です。`screens/` に定義された screen を参照します。
- `steps[].action` (optional): `string`
  - Description: この画面で行う操作です。最後のステップ（到達画面）では省略可能です。
- `steps[].expect` (optional): `string`
  - Description: この画面での期待結果です。最後のステップでは省略可能です。

## Writing Tips
- `workflow` は動詞句ベースの kebab-case にする（例: `user-registration`, `checkout-flow`）
- `steps` は画面を辿る順序で書く。最初の step が開始画面、最後の step が到達画面
- 最後の step は `screen` だけ（action/expect なし）でもよい。「ここに到達すれば OK」を表す
- 各 step の `screen` は screens/ に定義された screen ID と一致させる（validate で参照整合性チェック）
- 分岐があるフローは、分岐ごとに別の workflow を定義する（1 workflow = 1 パス）
- steps の値に `*`, `"`, `#`, `: ` 等の YAML 特殊文字が含まれる場合はクォートで囲むか表現を変える

## Workflow vs Screen の使い分け
- **Screen**: 1 画面内の操作と期待結果（単体テスト的）
- **Workflow**: 複数画面をまたぐシナリオ（E2E テスト的）
- Screen の `navigates_to` は 1 つの遷移を定義。Workflow は複数遷移の連鎖を定義
