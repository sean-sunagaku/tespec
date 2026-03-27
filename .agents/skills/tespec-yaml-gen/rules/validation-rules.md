# Validation Rules

> Generated from repository validation behavior and schema contracts for tespec v0.1.0.

## Command Modes
- `tespec validate --file <path>`: 単一 YAML ファイルの構文と Zod スキーマだけを検証します。`config.yaml` は不要です。
- `tespec validate --config <path>`: プロジェクト全体を読み込み、schema validation とクロスリファレンス validation の両方を行います。

## YAML Reference Example
```yaml
screen: home
route: /
title: ホーム画面
cases:
  - action: 一覧を見る
    expect: 一覧が表示される
    steps:
      - use:logged_in
      - / にアクセスする
    given: logged_in
    navigates_to: detail
```

## Cross-reference Rules
- `cases[].given` は既存の setup ID を参照する必要があります。
- `cases[].steps` の `use:<setup_id>` は既存の setup ID を参照する必要があります。
- `cases[].navigates_to` は既存の screen ID を参照する必要があります。
- `screen` と `setup` の ID はそれぞれ一意である必要があります。

## Item Meanings
- `given`: ケース開始前に満たしておきたい setup 条件です。
- `use:<setup_id>`: setup の step 群を呼び出すための特別な step 記法です。
- `navigates_to`: 操作後に遷移する screen ID です。

## Warning Rules
- `cases` が 0 件の screen は warning になります。
- `type: error` の case が 0 件の screen は warning になります。
- `type: boundary` の case が 0 件の screen は warning になります。

## Common Mistakes
- `steps` を空配列にする。
- `expect` や `given` の string / string[] を取り違える。
- setup ID や screen ID を自然文で書いてしまい、参照名と一致しない。
- 単一ファイル検証だけで参照整合性まで確認したつもりになる。
