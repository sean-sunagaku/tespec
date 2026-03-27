# Writing Guide

> Generated from authoring conventions for tespec v0.1.0.

## ID and Naming
- `screen` / `setup` は参照される ID なので、自然文ではなく安定した識別子にする。
- ID は短く、意味が分かり、将来変更しにくい名前にする。
- `title` は人が読む表示名にする。生成される describe やコメントにも使われる。

## Case Writing
- `action` は短く、テスト名として読める粒度で書く。
- `expect` は検証したい結果をそのまま書く。複数あるなら配列にする。
- `target` は必須ではないが、どこを操作するケースかを明確にしたいときに使う。

## Steps and Reuse
- `steps` は実行順どおりに書く。
- 共通前提は `use:<setup_id>` に寄せると再利用しやすい。
- setup 側の `steps` には、複数 screen で使う共通前提だけを入れる。

## References
- `given` は事前条件として必要な setup ID を表す。
- `navigates_to` は遷移先 screen ID を表す。
- `use:<setup_id>` と `given` は既存の setup ID に一致する必要がある。

## Example Patterns

### Screen
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

### Setup
```yaml
setup: logged_in
title: ログイン済み状態
steps:
  - テストユーザーでログインする
  - ダッシュボードが表示されることを確認する
```

## When to Validate
- 単体の YAML を素早く確かめたいときは `tespec validate --file <path>` を使う。
- 参照整合性まで含めて確認したいときは `tespec validate --config <path>` を使う。
