---
name: tespec-s04-imp
description: >
  tespec ワークフロー Step 4/4。tespec YAML 仕様からテスト駆動で実装するスキル。
  tespec generate で vitest テストスケルトンを生成し、テストの中身を実装してから
  本体コードを書く TDD ワークフロー。YAML → テスト → RED → 実装 → GREEN の流れを自動化する。
  Use when: tespec の YAML 仕様がある状態で実装を始めたい、TDD で実装したい、
  テストファーストで開発したい、YAML からテストを生成して実装したい。
  Triggers: "tespec-s04-imp", "TDD で実装", "テスト駆動で実装", "YAML からテスト生成して実装",
  "テストファースト", "test first", "RED GREEN", "spec から実装",
  "テスト書いてから実装", "generate してから実装", "仕様からTDD"
---

# tespec-s04-imp — tespec YAML 仕様からの TDD 実装

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
     ↓
Phase 7: 動作確認      ブラウザで実際に起動 → エラー検出 → YAML 追加 → テスト追加 → 修正
     ↓
Phase 8: E2E テスト    モックなしで実サービスを呼ぶテスト作成（CI 除外・ローカル専用）
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

- **screen specs** → `<output-dir>/screens/` 配下に生成
- **unit specs** → `<output-dir>/units/` 配下に生成
- **workflow specs** → `<output-dir>/workflows/` 配下に生成
- `--dry-run` で先にプレビューしてからファイル出力すると安全

### テストディレクトリ構成: tespec YAML と同じ構造にする

テストファイルの配置は tespec YAML のディレクトリ構成をそのままミラーする。
YAML と テストの対応関係が一目で分かるようにするため。

```
docs/tespec/                    tests/
├── screens/                    ├── screens/
│   ├── workspace.yaml          │   ├── workspace.test.tsx
│   ├── chat/                   │   ├── chat/
│   │   └── chat-pane.yaml      │   │   └── chat-pane.test.tsx
│   └── canvas/                 │   └── canvas/
│       └── canvas-pane.yaml    │       └── canvas-pane.test.tsx
├── units/                      ├── units/
│   ├── lib/ai/                 │   ├── lib/ai/
│   │   └── parser.yaml         │   │   └── parser.test.ts
│   └── store/                  │   └── store/
│       └── store.yaml          │       └── store.test.ts
└── workflows/                  └── workflows/
    └── save-load.yaml              └── save-load.spec.ts
```

**ルール:**
- `screens/*.yaml` → `tests/screens/*.test.tsx`（JSX を含むため `.tsx`）
- `units/*.yaml` → `tests/units/*.test.ts`（純粋関数のため `.ts`）
- `workflows/*.yaml` → `tests/workflows/*.spec.ts`（E2E 的シナリオは `.spec`）
- サブディレクトリ構造もそのまま維持する
- `tespec generate` で生成した後、手動でディレクトリを合わせる

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
- `references/e2e-testing.md` — E2E テスト（モックなし・ローカル専用）の書き方、vitest 設定、タイムアウト設定

### テストヘルパーの作成

テストで共通に使うフィクスチャやヘルパーを `tests/<feature>/helpers.ts` に用意する。
ヘルパーのデータは tespec YAML の内容を参考に、テストに必要最小限のデータを構築する。

### TODO の埋め方

生成されたスケルトンの `// TODO: implement` を、テスト層に応じて実装する。
各テストのコメント（Given, Steps, navigates_to, not_expect）をヒントにする。

### CRITICAL: スケルトン構造は変更禁止

`tespec generate` が生成したテストファイルの構造（`describe` / `it` のタイトル・ネスト・順序）は、テスト実装時に一切変更してはならない。

**変更してよいもの:**
- `// TODO: implement` を実際のテストコードに置き換える
- `import` 文を追加する
- ファイル冒頭に `// @vitest-environment jsdom` を追加する
- `beforeEach` / `afterEach` を追加する
- ヘルパー関数・モック定義を追加する

**変更してはいけないもの:**
- `describe("...")` のタイトル文字列
- `it("...")` のタイトル文字列
- `describe` / `it` のネスト構造
- `describe` / `it` の順序
- `describe` / `it` ブロックの追加・削除

スケルトンの構造は YAML の定義そのもの。テスト実装中に「この `it` のタイトルを変えたい」「case を追加したい」と思ったら、**tespec-s04-imp を止めて tespec-s03-yaml-gen で YAML を先に修正する**。YAML 修正 → テスト同期が終わってから tespec-s04-imp に戻る。

スケルトン構造を変更すると YAML との乖離が発生し、仕様とテストの対応関係が壊れる。YAML が single source of truth であるという原則を守るために、この制約は厳守する。

**Hook による強制（推奨）:** `scripts/check-skeleton-drift.sh` を PreToolUse Hook として設定すると、テストファイルの `describe`/`it` 構造を変更する Edit/Write が **ブロックされる**（exit 2 で拒否）。settings.json の hooks に以下を追加:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "echo \"$TOOL_INPUT\" | jq -re '.file_path | test(\"tests/\")' > /dev/null 2>&1 && bash <path-to-tespec-s04-imp>/scripts/check-skeleton-drift.sh || exit 0"
      }
    ]
  }
}
```

`jq` でファイルパスが `tests/` 配下かを先にチェックし、テストファイル以外はスクリプトを起動せず即 exit 0 する。テスト対象ディレクトリが異なる場合は `test(\"tests/\")` を変更する。

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

## Phase 7: 動作確認 → 不足検出

GREEN 確認・リファクタ後に、実際にアプリを起動してブラウザで動作確認する。
単体テストでは検出できない結合レベルの問題を見つけ、不足している YAML・テストを追加するフェーズ。

### 手順

```
1. dev サーバーを起動する
   ↓
2. ブラウザで主要な操作を実行する
   ↓
3. エラーが出たら原因を特定する
   ↓
4. 不足している YAML 定義を追加する（tespec-s03-yaml-gen）
   ↓
5. テストを追加して RED 確認する
   ↓
6. 実装を修正して GREEN にする
   ↓
7. 再度ブラウザで確認する → エラーがなくなるまで繰り返す
```

### ブラウザ確認の観点

dev サーバー起動後、以下を順に確認する:

| # | 確認項目 | 何を見るか |
|---|---------|----------|
| 1 | 画面表示 | 各画面が正常にレンダリングされるか（白画面・レイアウト崩れがないか） |
| 2 | コンソールエラー | ブラウザの DevTools Console にエラーが出ていないか |
| 3 | サーバーログ | ターミナルの dev サーバーログにエラーが出ていないか |
| 4 | 主要操作 | ボタンクリック・フォーム送信など主要な操作が動くか |
| 5 | API 通信 | サーバーとの通信が成功するか（Network タブで確認） |
| 6 | エラーハンドリング | 意図的にエラーを起こした場合に適切なメッセージが表示されるか |

### エラーから YAML 不足を検出するパターン

動作確認で見つかったエラーは、多くの場合 YAML 定義の不足が原因。
以下のパターンで YAML → テスト → 実装の不足を特定する:

| ランタイムエラー | 不足している YAML | 対応 |
|---------------|----------------|------|
| API が 500 を返す | Route Handler の error case | unit YAML にエラーハンドリング case を追加 |
| バリデーションなしで不正データが通る | 入力検証の error case | unit YAML にバリデーション case を追加 |
| 未処理の例外でクラッシュ | try/catch の error case | unit YAML にエラーハンドリング case を追加 |
| 環境変数未設定で動かない | 前提条件の error case | unit YAML に環境依存の error case を追加 |
| UI が反応しない | 画面操作の case 不足 | screen YAML に操作 case を追加 |
| 画面遷移が壊れている | 遷移の case 不足 | screen YAML に navigates_to case を追加 |

### CRITICAL: エラーを見つけたらまず YAML

動作確認でエラーを見つけた場合、**直接コードを修正してはいけない**。

1. まず `tespec-s03-yaml-gen` で YAML に case を追加する
2. `tespec validate` で確認する
3. テストを追加する（RED 確認）
4. **それから** 実装を修正する（GREEN 確認）

「早くエラーを直したい」衝動を抑えて、YAML → テスト → 実装の順序を守る。
この順序を守ることで、同じエラーの再発を防げる。

### ブラウザ自動化ツールがある場合

Chrome 操作ツール（Claude in Chrome 等）がある場合は積極的に使う:

1. 新しいタブを開いて dev サーバーの URL にアクセスする
2. スクリーンショットで画面の状態をキャプチャする
3. コンソールメッセージを読み取ってエラーを検出する
4. クリック・入力操作で主要フローを実行する
5. エラーがあれば YAML → テスト → 実装の順で修正する

---

## Phase 8: E2E テスト（モックなし・ローカル専用）

Phase 1〜7 で作成するテストはモックを使った高速テスト（CI 向け）。
Phase 8 では**モックなしで実際の外部サービスを呼ぶ E2E テスト**を追加する。

CI には入れない。ローカルでの動作確認・信頼性検証が目的。

### なぜモックなし E2E が必要か

unit テストではモックで外部サービスの呼び出しを検証する。しかし **モックが正しくても実際の呼び出しが壊れている** ことがある。E2E はそこを確認する:

- **呼び出しインターフェースが本当に合っているか**: `spawn` の引数、CLI のフラグ、オプションの渡し方がモック通りに実サービスで動くか
- **実際のレスポンス形式がパースできるか**: モックの返り値は想定通りだが、実サービスの出力フォーマットが変わっていないか
- **プロンプトが意図通りの応答を引き出すか**: モックでは検証できない AI の実際の振る舞い
- **結合部分が実データで壊れないか**: シリアライズ/デシリアライズが本物のデータで動くか

つまり E2E は「unit テストのモックが嘘をついていないか」を実呼び出しで裏取りするテスト。

外部サービスクライアントのモック unit テスト（`spawn` 引数の検証、エラーハンドリング等）は Phase 1〜5 の範囲。Phase 8 ではモックを一切使わない。

### CRITICAL: E2E テストも GREEN まで確認する

E2E テストは書いて終わりではない。**実際に実行して全パスするまでが Phase 8。**

```
1. YAML を書く（docs/tespec/e2e/）
   ↓
2. テストコードを書く（tests/e2e/）
   ↓
3. 実行する（npm run test:e2e）
   ↓
4. 失敗したら原因を特定して修正する
   ↓
5. 全パスするまで 3〜4 を繰り返す
   ↓
6. GREEN を確認して Phase 8 完了
```

### E2E テストの典型的な失敗パターンと対処

| 失敗パターン | 原因 | 対処 |
|------------|------|------|
| タイムアウト | AI の応答が遅い / プロンプトが長すぎる | プロンプトを短くする + タイムアウトを伸ばす |
| Connection refused | dev サーバーが起動していない | API Route テストの前に `npm run dev` を起動する |
| 404 Not Found | Route が存在しない | ファイルパス・export 名を確認 |
| JSON パースエラー | AI の応答形式が想定と違う | プロンプトをより明確にする |
| AI が指示と違う形式で返す | プロンプトが曖昧 | systemPrompt で形式を明示する |
| spawn ENOENT | `claude` CLI がインストールされていない | `claude --version` で確認 |

### E2E テストの実行条件

| 条件 | 必要 |
|------|------|
| Claude Code ログイン済み | 必須（`claude -p` が動くこと） |
| dev サーバー起動中 | API Route テストの場合のみ |
| API キー | 不要（Claude Code SDK は OAuth 認証） |
| CI 環境 | 実行しない |

具体的なコードの書き方、vitest 設定、プロンプトの書き方、タイムアウト設定は `references/e2e-testing.md` を参照。

---

## ユーザーへの進捗報告

各 Phase の完了時に状況を報告する:

```
Phase 1 完了: 4ファイル / 19テストケースのスケルトンを生成
Phase 2 完了: 19テストの TODO を全て実装。helpers.ts も作成
Phase 3 RED:  19テスト全て失敗（Cannot find module）
Phase 4 実装中: App.tsx 完了 → 12/19 通過
Phase 5 GREEN: 19テスト全て通過（既存テストも全パス）
Phase 7 動作確認: Route Handler エラーハンドリング不足を検出 → YAML 3 cases 追加 → 修正完了
Phase 8 E2E:  2ファイル / 8テスト ローカルで全パス（実 Claude CLI 呼び出し）
```

---

## コンテキスト判断

### tespec YAML が存在しない場合
先に YAML を書く必要がある。`tespec-s03-yaml-gen` スキルを案内する。

### テストスケルトンが既に存在する場合
Phase 2（テスト実装）から開始する。既存のスケルトンを読んで TODO の状態を確認する。

### 実装が既に存在する場合
テストを実行して現状を確認し、失敗しているテストがあれば Phase 4（実装修正）から。

### vitest 以外のターゲットが必要な場合
`tespec generate` は `playwright`, `xctest` もサポートしている。ユーザーに確認して適切なターゲットを選択する。
