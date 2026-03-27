# Setup Schema

> Generated from `src/core/schema.ts` by `scripts/generate-references.ts` for tespec v0.1.0.

setups/*.yaml の 1 setup 定義を表します。

## YAML Example
```yaml
setup: logged_in
title: ログイン済み状態
steps:
  - テストユーザーでログインする
  - ダッシュボードが表示されることを確認する
```

## Root Rules
- Type: `object`
- Additional properties: `not allowed`

## Field Guide
- `setup` (required): `string`
  - Description: setup を識別する一意 ID です。`given` や `use:<setup_id>` から参照されるため、用途が分かる短い名前にします。
- `title` (required): `string`
  - Description: 人が読む setup 名です。生成されるコメントや説明文に使われます。
- `steps` (required): `array<string>`
  - Description: その setup を成立させるための共通手順です。空配列は許可されますが、通常は少なくとも 1 手順書きます。

## Writing Tips
- `setup` は状態名ベースで付けると再利用しやすい。
- `steps` は他の screen でも使える共通前提だけを入れる。
- `steps` の値に `*`, `"`, `#`, `: ` 等の YAML 特殊文字が含まれる場合はクォートで囲むか表現を変える（詳細は `case-schema.md` の「YAML 特殊文字の注意」参照）。
