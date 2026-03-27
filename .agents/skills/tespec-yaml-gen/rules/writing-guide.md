# Writing Guide

> Generated from authoring conventions for tespec v0.1.0.

## 画面遷移と操作の洗い出し（YAML を書く前に）

YAML をいきなり書かず、まず画面構成と操作を整理する。これが仕様の骨格になる。

### Step 1: 画面を列挙する

機能に必要な画面を全てリストアップする。各画面に ID, タイトル, route を決める。

```
| 画面 ID | タイトル | Route |
|---------|---------|-------|
| dashboard | ダッシュボード | / |
| detail | 詳細画面 | /#/items/:id |
| settings | 設定 | /#/settings |
```

### Step 2: 各画面の操作を洗い出す

画面ごとに「ユーザーが何をするか」を具体的な動詞で書き出す。
これが YAML の `action` + `steps` になる。

```
dashboard:
  - ページを開く → 一覧が表示される
  - 項目をクリックする → 詳細画面に遷移する (navigates_to: detail)
  - 検索する → フィルタされた結果が表示される
  - エラー状態で開く → エラーメッセージが表示される (type: error)
  - 0件の状態で開く → 空メッセージが表示される (type: boundary)
```

操作の洗い出しでは以下を意識する:
- **正常系**: 普通に使うときの操作（type: normal）
- **異常系**: エラーが起きたときの挙動（type: error）
- **境界値**: 0件、上限、空文字など（type: boundary）
- **遷移**: 別の画面に移動する操作（navigates_to を使う）

### Step 3: 画面遷移を整理する

操作の中から画面遷移を抜き出し、`navigates_to` として記録する。
双方向遷移（行って戻る）も忘れない。

```
dashboard → detail    (項目をクリック)
detail → dashboard    (戻るボタン)
detail → settings     (設定リンク)
settings → dashboard  (保存して戻る)
```

### Step 4: 前提条件を setup に抽出する

複数の画面・ケースで共通に必要な前提条件を setup として切り出す。

```yaml
# 「ログイン済み」を複数画面で使うなら setup にする
setup: logged_in
title: ログイン済み状態
steps:
  - テストユーザーでログインする
```

screen 側では `given: logged_in` と `use:logged_in` で参照する。

### Step 5: YAML に落とす

上の整理結果をそのまま YAML に書く。操作 1 つ = case 1 つ。

---

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
