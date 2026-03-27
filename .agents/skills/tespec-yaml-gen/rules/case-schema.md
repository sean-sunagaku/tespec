# Case Schema

> Generated from `src/core/schema.ts` by `scripts/generate-references.ts` for tespec v0.1.0.

Screen 内の 1 テストケースを表します。

## YAML Example
```yaml
action: 誤った認証情報で送信する
expect:
  - エラーメッセージが表示される
  - ログインに失敗する
steps:
  - use:logged_in
  - /login にアクセスする
  - 誤ったメールアドレスを入力する
  - 誤ったパスワードを入力する
  - 送信ボタンをクリックする
given: logged_in
target: ログインフォーム
type: error
not_expect:
  - ダッシュボードへ遷移する
navigates_to: login
```

## Root Rules
- Type: `object`
- Additional properties: `not allowed`

## Field Guide
- `action` (required): `string`
  - Description: テストケースで何をするのかを短い自然文で書きます。生成されるテスト名の前半になります。
- `expect` (required): `string | array<string>`
  - Description: 主要な期待結果を書きます。1 つだけなら string、複数の期待結果を列挙したいときは string[] を使います。
- `steps` (required): `array<string>`
  - Description: テスト実行手順を順番どおりに並べます。最低 1 件必要で、`use:<setup_id>` は setup 呼び出しとして扱われます。
  - Constraint: array length must be at least `1`.
- `given` (optional): `string | array<string>`
  - Description: 事前条件として必要な setup ID を書きます。複数条件が必要なら配列にします。テスト名の prefix にも使われます。
- `target` (optional): `string`
  - Description: 主に操作対象の UI 要素や領域を書きます。必須ではありませんが、ケースの意図が読みやすくなります。
- `type` (required): `"normal" | "error" | "boundary"`
  - Description: ケースの分類です。通常系は `normal`、異常系は `error`、境界値ケースは `boundary` を使います。未指定時は `normal` です。
  - Default: `"normal"`
- `not_expect` (optional): `array<string>`
  - Description: 起きてほしくない結果を書きます。生成されるスケルトン内の補助コメントとして使えます。
- `navigates_to` (optional): `string`
  - Description: 遷移後に表示される screen ID を指定します。既存の `screen` 値と一致させます。

## Writing Tips
- `action` と `expect` はテスト名に近い粒度で簡潔に書く。
- `steps` は人が読んで実装順を迷わない並びにする。
- `type: error` と `type: boundary` を最低 1 件ずつ持たせると warning を避けやすい。

## 操作と遷移の書き方

### 操作（steps）の具体性

steps は「テストを書く人が迷わない」レベルの具体性で書く。

**良い例（具体的な UI 操作）:**
```yaml
steps:
  - /login にアクセスする
  - メールアドレス欄にテストユーザーのメールを入力する
  - パスワード欄にパスワードを入力する
  - 送信ボタンをクリックする
```

**悪い例（抽象的すぎる）:**
```yaml
steps:
  - ログインする
```

### 画面遷移（navigates_to）

操作の結果として別の画面に遷移する場合、`navigates_to` を使う。
遷移先の screen ID は、同じ config.yaml 内に存在する screen の ID と一致させる。

```yaml
- action: ログインする
  steps:
    - 認証情報を入力して送信する
  expect: ダッシュボードに遷移する
  navigates_to: dashboard    # ← dashboard.yaml の screen: dashboard と一致
```

### 操作の網羅性チェックリスト

各画面で以下の操作パターンを検討する:
- **表示**: 画面を開いたときに何が見えるか
- **入力**: フォーム入力、テキスト入力、選択
- **操作**: ボタンクリック、スワイプ、ドラッグ
- **遷移**: 他の画面への移動（navigates_to）
- **更新**: データが変わったときの表示更新
- **エラー**: ネットワーク切断、バリデーションエラー
- **境界**: 0件、上限、長い文字列
