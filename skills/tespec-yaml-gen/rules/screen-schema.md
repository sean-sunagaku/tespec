# Screen Schema

> Generated from `src/core/schema.ts` by `scripts/generate-references.ts` for tespec v0.1.0.

screens/*.yaml の 1 画面定義を表します。

## YAML Example
```yaml
screen: login
route: /login
title: ログイン画面
cases:
  - action: 正しい認証情報で送信する
    expect: ダッシュボードへ遷移する
    steps:
      - /login にアクセスする
      - 正しいメールアドレスを入力する
      - 正しいパスワードを入力する
      - 送信ボタンをクリックする
    type: normal
    navigates_to: dashboard
```

## Root Rules
- Type: `object`
- Additional properties: `not allowed`

## Field Guide
- `screen` (required): `string`
  - Description: 画面を識別する一意 ID です。`navigates_to` の参照先として使われるので、短く安定した名前にします。
- `route` (required): `string`
  - Description: その画面を開く URL やルートパスを書きます。手動ステップやナビゲーション説明の基準になります。
- `title` (required): `string`
  - Description: 人が読む画面名です。生成される `test.describe()` のタイトルとして使われます。
- `cases` (required): `array<object>`
  - Description: その画面で確認したい操作と期待結果の一覧です。各要素は `Case Schema` に従います。
- `cases[].action` (required): `string`
  - Description: ケースごとの操作名です。何をするケースかが一目で分かるように書きます。
- `cases[].expect` (required): `string | array<string>`
  - Description: ケースの主要な期待結果です。複数あるなら配列にします。
- `cases[].steps` (required): `array<string>`
  - Description: ケースを再現する具体的な手順です。1 件以上必須です。
  - Constraint: array length must be at least `1`.
- `cases[].given` (optional): `string | array<string>`
  - Description: ケース開始前に満たしておきたい setup 条件です。
- `cases[].target` (optional): `string`
  - Description: その操作が向く UI 要素や機能名です。
- `cases[].type` (required): `"normal" | "error" | "boundary"`
  - Description: 正常系・異常系・境界値のどれかを表します。
  - Default: `"normal"`
- `cases[].not_expect` (optional): `array<string>`
  - Description: 期待しない結果や回避したい振る舞いです。
- `cases[].navigates_to` (optional): `string`
  - Description: 遷移先の screen ID です。

## Writing Tips
- `screen` は snake_case や kebab-case のような安定した ID にする。
- `title` は実際の画面名に寄せて、日本語のままでも問題ない。
- `cases` は正常系だけでなく異常系と境界値も混ぜる。
- 値に `*`, `"`, `#`, `: ` 等の YAML 特殊文字が含まれる場合はクォートで囲むか表現を変える（詳細は `case-schema.md` の「YAML 特殊文字の注意」参照）。
