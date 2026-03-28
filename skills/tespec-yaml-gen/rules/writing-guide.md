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

### Workflow
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
  - screen: dashboard
```

### Workflow の書き方
- 1 workflow = 1 パス。分岐がある場合は別 workflow に分ける
- `steps[].screen` は screens/ に定義された screen ID を参照する
- 最後の step は到達画面なので `action` / `expect` は省略可能
- Screen の `navigates_to` が 1 遷移の定義なのに対し、Workflow は複数遷移の連鎖を定義する

## YAML 特殊文字の注意

YAML の値に以下の文字・パターンが含まれると構文エラーになる。**クォートで囲むか、表現を変えて回避する。**

| パターン | 問題 | 対処法 |
|---------|------|--------|
| `*` で始まる値 | YAML のアンカー参照と誤認 | `"*foo"` とクォート、または `foo パターン` と言い換え |
| `"..."` を含む値 | クォートの入れ子で構文エラー | 内側のクォートを外す、または `'` で外側を囲む |
| `//` を含む値 | YAML パーサーによっては問題 | クォートで囲むか、`コメント` と日本語で書く |
| `#` を含む値 | YAML コメントと誤認 | `"値に#を含む"` とクォートで囲む |
| `: ` を含む値 | YAML のキーと誤認 | `"キー: 値"` とクォートで囲む |
| `[`, `]`, `{`, `}` | YAML のフロースタイルと誤認 | クォートで囲む |

### 良い例と悪い例

```yaml
# BAD: * がアンカー参照と誤認される
- action: *Tests.swift ファイルを収集する

# GOOD: 表現を変える
- action: Tests.swift パターンのファイルを収集する

# BAD: 二重引用符の入れ子
- action: "// TODO: implement" を検出する

# GOOD: 表現を変える
- action: TODO implement コメントを検出する

# GOOD: シングルクォートで囲む
- action: '"// TODO: implement" を検出する'
```

## When to Validate
- 単体の YAML を素早く確かめたいときは `tespec validate --file <path>` を使う。
- 参照整合性まで含めて確認したいときは `tespec validate --config <path>` を使う。
