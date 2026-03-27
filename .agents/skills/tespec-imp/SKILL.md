---
name: tespec-imp
description: >
  tespec YAML 仕様からテスト駆動で実装するスキル。
  tespec generate で vitest テストスケルトンを生成し、テストの中身を実装してから
  本体コードを書く TDD ワークフロー。YAML → テスト → RED → 実装 → GREEN の流れを自動化する。
  Use when: tespec の YAML 仕様がある状態で実装を始めたい、TDD で実装したい、
  テストファーストで開発したい、YAML からテストを生成して実装したい。
  Triggers: "tespec-imp", "TDD で実装", "テスト駆動で実装", "YAML からテスト生成して実装",
  "テストファースト", "test first", "RED GREEN", "spec から実装",
  "テスト書いてから実装", "generate してから実装", "仕様からTDD"
---

# tespec-imp — tespec YAML 仕様からの TDD 実装

tespec YAML で定義された画面仕様・ユニット仕様から、テスト駆動開発（TDD）で実装するスキル。

## なぜ TDD か

tespec YAML は「何を作るか」を宣言的に記述している。
これをそのままテストに変換し、テストを先に書くことで:
- 仕様とテストの乖離がゼロになる
- 実装の完了条件が明確（テストが通れば完了）
- リグレッションを防げる

## ワークフロー

```
Phase 1: テスト生成     tespec generate -t vitest でスケルトン生成
     ↓
Phase 2: テスト実装     TODO コメントを実際のテストコードに置き換え
     ↓
Phase 3: RED 確認      テスト実行 → 全テスト失敗を確認
     ↓  ━━━ ここまでテスト完了。実装コードは一切書かない ━━━
     ↓
Phase 4: 実装          テストを通すための最小限のコードを書く
     ↓
Phase 5: GREEN 確認    テスト実行 → 全テスト通過を確認
     ↓
Phase 6: リファクタ     テストが通る状態を維持しながらコード改善
```

### CRITICAL: テスト完全完了ルール

**Phase 1〜3 が全て完了するまで、Phase 4（実装）のコードを一切書いてはならない。**

- テストファイルを「全部」書き切る。fixture も含む
- RED を確認する（テスト実行 → 全失敗）
- RED が確認できて初めて実装を開始する

**Agent ツールを使う場合も同じ:**
- テスト作成エージェントと実装エージェントを **別セッション** で起動する
- テスト作成エージェントが完了 → RED 確認 → 実装エージェント起動、の順序を守る
- 1つのエージェントにテストと実装を同時に任せない（テストが実装に引っ張られて甘くなる）

**なぜ分離するか:**
- テストと実装を同時に書くと、実装に合わせてテストを調整してしまう
- テストが先にあることで「実装の仕様書」として機能する
- RED が確認できないと、テストが本当に動いているか分からない

---

## Phase 1: テスト生成

### 前提確認

1. tespec YAML が存在することを確認:
   ```bash
   tespec validate -c <config-path>
   ```
   エラーがあれば先に YAML を修正する。warning のみなら続行。

2. config.yaml の場所を特定:
   - デフォルト: `docs/tespec/config.yaml`
   - ユーザーが指定した場合はそのパス

### テストスケルトン生成

```bash
tespec generate -c <config-path> -t vitest -o <output-dir>
```

- **screen specs** → `<output-dir>/<screen-id>.test.ts` として生成
- **unit specs** → `<output-dir>/<unit-id>.test.ts` として生成（`--unit-target vitest`）
- `--dry-run` で先にプレビューしてからファイル出力すると安全

**出力先のデフォルト**: `tests/<feature-name>/`（機能名でディレクトリを切る）

---

## Phase 2: テスト実装

### テスト3層構成

tespec YAML の画面仕様は、プロジェクトの技術スタックに応じて以下の3層でテストする:

| 層 | テスト対象 | 何を検証 |
|---|---|---|
| **Component** | UI コンポーネント | クリック → 画面遷移、表示内容、インタラクション |
| **API** | サーバーエンドポイント | HTTP レスポンス、データ形式 |
| **Integration** | システム間連携 | ファイル変更 → watcher 検知、サーバー + SSE パイプライン |
| **Unit** | ビジネスロジック | 関数の入出力、バリデーション |

### YAML case → テスト層のマッピング

YAML の case 内容から、どの層でテストすべきか判断する:

| YAML の内容 | テスト層 | 理由 |
|------------|---------|------|
| 「○○をクリック → △△が表示される」 | Component | DOM インタラクション |
| 「○○にアクセスする → △△が表示される」 | Component | 初期レンダリング検証 |
| 「navigates_to: xxx」 | Component | 画面遷移はルーティングテスト |
| 「YAML 変更 → 自動更新」 | Integration | 実ファイル書き換え → watcher 検知 → 更新 |
| 「ファイル追加 → 検知」 | Integration | 実ファイル追加 → watcher の onUpdate |
| 「API がデータを返す」 | API | サーバーレスポンス |
| 「○○を計算する → △△が返る」 | Unit | 純粋ロジック |

### UI コンポーネントのテスト方針

画面の操作テスト（クリック、入力、遷移）には、**UI コンポーネントを独立したモジュールに分離**する。
インラインの HTML テンプレートに埋め込むと jsdom でテストできないため、
import 可能なコンポーネントとして書く。

技術スタック別の具体的なパターンは `references/` を参照:
- `references/component-testing.md` — Preact / React コンポーネントテストの実装パターン（test-id ルール含む）
- `references/api-testing.md` — Hono / Express 等のサーバー API テストパターン
- `references/integration-testing.md` — ファイル監視・サーバーパイプラインの統合テストパターン
- `references/spec-coverage.md` — YAML 仕様とテストファイルの整合性チェック（メタテスト）

### テストヘルパーの作成

テストで共通に使うフィクスチャやヘルパーを `tests/<feature>/helpers.ts` に用意する。
ヘルパーのデータは tespec YAML の内容を参考に、テストに必要最小限のデータを構築する。

### TODO の埋め方

生成されたスケルトンの `// TODO: implement` を、テスト層に応じて実装する。
各テストのコメント（Given, Steps, navigates_to, not_expect）をヒントにする。

### テスト実装のルール

- **import は実装予定のモジュールから**: まだ存在しないファイルを import する（RED の原因になる）
- **UI テストは jsdom 環境で**: ファイル冒頭に `// @vitest-environment jsdom` を追加
- **port: 0 を使う**: サーバーテストではランダムポートを使い、テスト間の競合を避ける
- **finally で cleanup**: サーバーやリソースは必ず `finally` で解放する
- **テストは独立**: 各テストが単独で実行できること。共有状態を持たない

---

## Phase 3: RED 確認

```bash
pnpm test -- tests/<feature>/
```

全テストが失敗することを確認する。失敗理由は:
- `Cannot find module` — 実装ファイルが存在しない
- `is not a function` — export が存在しない

**RED にならない場合**: テストが甘い可能性がある。実装なしでも通るテストは意味がない。

---

## Phase 4: 実装

RED のテストを GREEN にするための最小限のコードを書く。

### 実装の順序

テストの依存関係から実装順序を決める:

1. **型定義・インターフェース** — テストが import する型
2. **UI コンポーネント** — テスト可能な独立モジュール
3. **純粋関数**（副作用なし）— データ変換、テンプレート
4. **副作用あり関数** — HTTP サーバー、ファイル監視
5. **オーケストレーター** — エントリーポイント

### 実装のルール

- **テストを通すことだけに集中する**: 美しいコードより動くコード
- **テストにないものは実装しない**: YAGNI
- **1つのテストが通ったら次へ**: 全部一度に実装しない

### 実装中のテスト実行

テストを頻繁に実行して進捗を確認する:

```bash
pnpm test -- tests/<feature>/<file>.test.ts   # 特定ファイル
pnpm test -- tests/<feature>/                  # feature 全体
```

---

## Phase 5: GREEN 確認

```bash
pnpm test
```

全テスト（既存 + 新規）が通ることを確認する。

---

## Phase 6: リファクタ

テストが GREEN の状態を維持しながら:
- 重複コードの除去
- 命名の改善
- モジュール分割の調整

リファクタ後も `pnpm test` が全パスすることを確認する。

---

## ユーザーへの進捗報告

各 Phase の完了時に状況を報告する:

```
Phase 1 完了: 4ファイル / 19テストケースのスケルトンを生成
Phase 2 完了: 19テストの TODO を全て実装。helpers.ts も作成
Phase 3 RED:  19テスト全て失敗（Cannot find module）
Phase 4 実装中: App.tsx 完了 → 12/19 通過
Phase 5 GREEN: 19テスト全て通過（既存テストも全パス）
```

---

## コンテキスト判断

### tespec YAML が存在しない場合
先に YAML を書く必要がある。`/tespec-yaml-gen` スキルを案内する。

### テストスケルトンが既に存在する場合
Phase 2（テスト実装）から開始する。既存のスケルトンを読んで TODO の状態を確認する。

### 実装が既に存在する場合
テストを実行して現状を確認し、失敗しているテストがあれば Phase 4（実装修正）から。

### vitest 以外のターゲットが必要な場合
`tespec generate` は `playwright`, `xctest` もサポートしている。ユーザーに確認して適切なターゲットを選択する。
