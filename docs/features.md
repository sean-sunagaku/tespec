# e2e-spec 機能仕様

E2E の仕様を YAML で定義し、テストスケルトンを生成し、全テストが通るまで作り切るための CLI ツール。

---

## コンセプト

### 解決する課題

| 課題 | e2e-spec の解決策 |
|---|---|
| テストを後付けで書くと漏れが出る | YAML で先に仕様を定義してからコードを書く |
| 何がテスト済みで何が未実装か分からない | YAML の `status` フィールドで機械的に追跡 |
| E2E で全部テストすると遅い・壊れやすい | 3 層ピラミッド (unit/integration/e2e) に分離 |
| テストコードのスケルトンを毎回手で書くのが面倒 | YAML から自動生成 |
| AI にテストを書かせると仕様の全体像が見えない | YAML が正本なので AI は「何を書くべきか」が明確 |

### ワークフロー

```
1. npx e2e-spec init          → test-plan.yaml を生成
2. YAML にケースを書く          → 仕様定義 (人間 or AI)
3. npx e2e-spec generate      → テストスケルトン生成
4. スケルトンの TODO を埋める    → テスト実装 (人間 or AI)
5. テスト実行                   → pnpm test / pnpm e2e
6. npx e2e-spec sync          → 結果を YAML に反映
7. npx e2e-spec status        → 未実装・失敗を確認
8. 4 に戻る (全 pass まで)
```

### テストピラミッド

```
         ┌─────────┐
         │   E2E   │  ブラウザ操作フロー
        ─┼─────────┼─
        │Integration│  route handler (HTTP request → response)
       ─┼──────────┼─
       │    Unit    │  純粋関数・ドメインロジック
       └───────────┘
```

| 層 | 確認すること | 確認しないこと |
|---|---|---|
| unit | 入力→出力、境界値、エラー分岐 | HTTP, DB, ブラウザ |
| integration | status code、response body、エラーハンドリング | ブラウザ UI |
| e2e | ユーザー操作→画面反映 | unit/integration で検証済みの分岐 |

上の層で確認済みのことを下の層で再確認しない。

---

## CLI コマンド

### `e2e-spec init`

プロジェクトにテスト計画の雛形を生成する。

```bash
npx e2e-spec init [--dir <path>] [--framework <vitest|jest>] [--e2e <playwright|cypress>]
```

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--dir` | `docs/test-plan` | YAML ファイルの出力先 |
| `--framework` | `vitest` | 単体/結合テストフレームワーク |
| `--e2e` | `playwright` | E2E テストフレームワーク |

生成されるファイル:
- `e2e-spec.config.yaml` — プロジェクト設定 (フレームワーク、ファイルパターン、テスト計画のパス)
- `test-plan.yaml` — サンプルケース 3 件入りのテンプレート

---

### `e2e-spec generate`

YAML の `status: not_implemented` のケースからテストスケルトンを生成する。

```bash
npx e2e-spec generate [--config <path>] [--dry-run] [--layer <unit|integration|e2e>]
```

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--config` | `docs/test-plan/e2e-spec.config.yaml` | 設定ファイル |
| `--dry-run` | `false` | 書き込まず stdout に出力 |
| `--layer` | 全層 | 特定の層だけ生成 |

動作:
- テストファイルが存在しない → 新規作成
- テストファイルが存在する → 既存の case ID をスキャンし、未実装分だけ追記
- 既存テストは一切変更しない

出力例:
```
e2e-spec generate

  Found 12 not_implemented cases across 4 files.

  [NEW]    src/core/__tests__/prompt.test.ts         (3 cases)
  [NEW]    src/core/__tests__/layout.test.ts         (4 cases)
  [APPEND] src/routes/__tests__/gen.integration.test.ts (2 cases)
  [SKIP]   e2e/ui-flows.spec.ts                     (3 cases already present)

  Generated: 9 skeletons
  Skipped:   3 (already in code)
```

スケルトン生成ルール:
- テスト名に case ID をプレフィックス: `test("U-PROMPT-001: 空文字 → err")`
- assertions 配列の各項目が個別の `test()` になる
- 同じ `target.symbol` は同じ `describe` にまとめる
- テスト本体は `// TODO: implement` のみ

---

### `e2e-spec status`

YAML とテストコードの実装状況を突き合わせて表示する。

```bash
npx e2e-spec status [--config <path>] [--format <table|json|yaml>]
```

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--config` | `docs/test-plan/e2e-spec.config.yaml` | 設定ファイル |
| `--format` | `table` | 出力形式 |

出力例:
```
e2e-spec status

  Layer         Total  Pass  Fail  Impl  Not Impl
  ─────────────────────────────────────────────────
  unit           18    12     1     3      2
  integration    14     8     0     4      2
  e2e             5     3     0     1      1
  ─────────────────────────────────────────────────
  Total          37    23     1     8      5

  Failed:
    U-HTML-005  src/core/__tests__/html.test.ts  "sanitizeHtml: script タグ除去"

  Not implemented:
    U-GEN-005   src/core/__tests__/generation.test.ts
    U-GEN-006   src/core/__tests__/generation.test.ts
    I-RETRY-002 src/routes/__tests__/cards.integration.test.ts
    E-FLOW-005  e2e/ui-flows.spec.ts
```

判定ロジック:
- YAML にあるがコードに case ID がない → `not_implemented`
- コードに case ID があるが `// TODO` が残っている → `implemented`
- YAML の status が `pass` → `pass`
- YAML の status が `fail` → `fail`

---

### `e2e-spec sync`

テスト実行結果を読み取り、YAML の `status` を自動更新する。

```bash
npx e2e-spec sync [--config <path>] [--result <path>]
```

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--config` | `docs/test-plan/e2e-spec.config.yaml` | 設定ファイル |
| `--result` | 自動検出 | テスト結果 JSON のパス |

動作:
- テスト名から case ID を抽出
- テスト pass → `status: pass`
- テスト fail → `status: fail`
- case ID がテスト結果にない → 変更しない

対応するテスト結果形式:
- vitest (`vitest --reporter=json`)
- jest (`jest --json`)
- playwright (`playwright test --reporter=json`)

結果ファイルは `--result` で指定するか、自動検出 (cwd の `vitest.json`, `test-results/results.json`, `jest.json`)。

---

### `e2e-spec validate`

YAML のフォーマットを検証する。CI で使う想定。

```bash
npx e2e-spec validate [--config <path>]
```

チェック項目:

| チェック | レベル |
|---|---|
| case ID の形式が正しいか | error |
| case ID が重複していないか | error |
| layer が有効値か | error |
| depends_on の参照先が存在するか | error |
| 循環依存がないか | error |
| assertions が空でないか | warning |
| spec_file が存在するか (status != not_implemented の場合) | warning |

exit code: `0` = OK, `1` = error あり

---

## YAML フォーマット

### 設定ファイル (e2e-spec.config.yaml)

```yaml
version: 1
project: "my-project"

layers:
  unit:
    framework: "vitest"
    command: "pnpm test"
    file_pattern: "**/*.test.ts"
    spec_dir: "{source}/__tests__"
    spec_suffix: ".test.ts"
  integration:
    framework: "vitest"
    command: "pnpm test:integration"
    file_pattern: "**/*.integration.test.ts"
    spec_dir: "{source}/__tests__"
    spec_suffix: ".integration.test.ts"
  e2e:
    framework: "playwright"
    command: "pnpm e2e"
    file_pattern: "e2e/**/*.spec.ts"
    spec_dir: "e2e"
    spec_suffix: ".spec.ts"

plans:
  - "docs/test-plan/test-plan.yaml"
```

カスタムテンプレートを使う場合:
```yaml
layers:
  unit:
    framework: "vitest"
    template: "./templates/my-unit-template.ts"
```

### テスト計画 (test-plan.yaml)

```yaml
version: 1

cases:
  - id: "U-PROMPT-001"
    layer: "unit"
    title: "空文字 prompt はバリデーションエラー"
    target:
      file: "src/core/prompt.ts"
      symbol: "buildPrompt"
    spec_file: "src/core/__tests__/prompt.test.ts"
    depends_on: []
    status: "not_implemented"
    assertions:
      - "空文字 → err(VALIDATION)"
      - "空白のみ → err(VALIDATION)"

  - id: "I-GEN-001"
    layer: "integration"
    title: "POST /api/generations が cards を返す"
    target:
      file: "src/routes/generations.ts"
      symbol: "POST /api/generations"
    spec_file: "src/routes/__tests__/generations.integration.test.ts"
    depends_on: ["U-PROMPT-001"]
    status: "not_implemented"
    assertions:
      - "正常 payload → 201 + cards 配列"

  - id: "E-FLOW-001"
    layer: "e2e"
    title: "生成してカードが表示される"
    spec_file: "e2e/ui-flows.spec.ts"
    depends_on: ["I-GEN-001"]
    status: "not_implemented"
    procedures: ["PROC-01", "PROC-02"]
    assertions:
      - "ModelSelector で CLI 選択 → 生成 → カード表示"
```

### case フィールド一覧

| フィールド | 必須 | 説明 |
|---|---|---|
| `id` | yes | ユニーク ID。形式: `{U|I|E}-{DOMAIN}-{3桁}` |
| `layer` | yes | `unit`, `integration`, `e2e` |
| `title` | yes | 人間向けの説明 |
| `target` | no | テスト対象 (file + symbol) |
| `spec_file` | yes | テストファイルのパス |
| `depends_on` | no | 前提となる case ID のリスト |
| `status` | yes | `not_implemented`, `implemented`, `pass`, `fail`, `skip` |
| `procedures` | no | 共通手順 ID (e2e 用) |
| `assertions` | yes | 検証項目 (1 つ以上) |

### case ID 命名規則

```
{層プレフィックス}-{ドメイン}-{連番3桁}

U = unit       例: U-PROMPT-001, U-LAYOUT-003
I = integration 例: I-GEN-001, I-CARD-005
E = e2e         例: E-FLOW-001
```

ドメインはプロジェクトのモジュール名に対応させる。

### status の遷移

```
not_implemented → implemented → pass
                             → fail → implemented (修正後)

どこからでも → skip (意図的スキップ)
```

### depends_on

「このケースが意味を持つ前提条件」を示す。実行順の強制ではなく、何が壊れたらこのケースも信用できないかを表す。

```yaml
- id: "I-GEN-001"
  depends_on: ["U-PROMPT-001"]
  # prompt validation が壊れていたら route テストの結果も信用できない
```

---

## 対応フレームワーク

### v1 (初期リリース)

| 層 | フレームワーク |
|---|---|
| unit / integration | vitest |
| e2e | playwright |

### v2 以降

| 層 | 追加対応 |
|---|---|
| unit / integration | jest |
| e2e | cypress |
| カスタム | ユーザー定義テンプレート |

---

## 将来の機能

### `e2e-spec scan`

ソースコードを読んでテスト対象を自動で洗い出し、YAML にケースを追記する。

```bash
npx e2e-spec scan --src src/core
```

### `e2e-spec next`

次に実装すべきケースを、AI へのプロンプト形式で出力する。

```bash
npx e2e-spec next --format prompt
```

```
次の 3 ケースを実装してください。

## U-PROMPT-001: 空文字 prompt はバリデーションエラー
- ファイル: src/core/__tests__/prompt.test.ts
- 対象: src/core/prompt.ts の buildPrompt
- assertions:
  - 空文字 → err(VALIDATION)
  - 空白のみ → err(VALIDATION)
```

### GitHub Actions 連携

PR に「テスト実装状況」をコメントする GitHub Action。

### `e2e-spec watch`

テスト実行を watch し、リアルタイムで YAML の status を更新する。

---

## ケース設計ガイドライン

### 各層のチェックリスト

YAML にケースを追加するとき、以下を確認する。

#### Unit

- [ ] 正常入力 → 期待出力 (happy path)
- [ ] 境界値 (0, 1, max, max+1)
- [ ] 空入力 / null / undefined
- [ ] エラーコードが正しいか
- [ ] 副作用がないか (純粋関数であることの確認)

#### Integration

- [ ] 正常 payload → 正しい status code + body
- [ ] 必須フィールド欠落 → 400
- [ ] 存在しないリソース → 404
- [ ] 不正な状態遷移 → 400 or 409
- [ ] セキュリティ (path traversal, injection)

#### E2E

- [ ] ユーザーが実際に行う操作手順を再現できているか
- [ ] unit/integration で検証済みの分岐を重複テストしていないか
- [ ] 共通手順が procedures に切り出されているか
- [ ] テストが他のテストに依存していないか (独立実行可能)

---

## E2E で見落としやすいパターン集

実プロジェクトでの失敗事例から抽出した、どのプロジェクトでも起こりうる「E2E の盲点」。

YAML でケースを設計するとき、以下のパターンが漏れていないかチェックする。

### パターン 1: 初期状態テストの欠落

**症状**: パラメータ付き URL (`?id=xxx`) でしか E2E を書いていないため、パラメータなしの初期状態 (`/`) が壊れていても検知できない。

**具体例**:
- E2E は全て `/?projectId=xxx` で開いていた
- 素の `/` を開くと、テスト用の失敗 fixture が最初に表示されていた

**ガイドライン**:
- パラメータ付き遷移とは別に、**パラメータなしの既定状態を必ず 1 ケース持つ**
- 初期状態で「何が選ばれるか」「何が表示されるか」を明示的にテストする

```yaml
# 良い例: 初期状態を明示的にテスト
- id: "E-INIT-001"
  layer: "e2e"
  title: "パラメータなしで開いたときの初期状態"
  spec_file: "e2e/init.spec.ts"
  assertions:
    - "素の / で開くと正常な project が表示される"
    - "テスト用 fixture が既定表示されない"
```

### パターン 2: Mock で隠れた外部依存

**症状**: E2E が mock/stub を使っていて、実際の外部サービス・CLI の起動仕様が検証されていない。

**具体例**:
- E2E は mock CLI を注入していた
- 実際の CLI (`codex`) は `stdin is not a terminal` で失敗した
- コマンドの引数 (`-p`, `exec`, `--skip-git-repo-check`) が間違っていても E2E は通った

**ガイドライン**:
- 外部 CLI / API の起動仕様は **E2E の責務外**。unit / integration で守る
- 実環境でしか検証できないものは **optional smoke test** として分離する
- mock で差し替えた境界を YAML にコメントで明記する

```yaml
# 良い例: 層を分けて外部依存を守る
- id: "U-RUNNER-001"
  layer: "unit"
  title: "codex の起動コマンドが正しい"
  target:
    file: "src/shell/cli-runner.ts"
    symbol: "buildCommand"
  spec_file: "src/shell/__tests__/cli-runner.test.ts"
  assertions:
    - "codex → ['codex', 'exec', '--skip-git-repo-check']"
    - "claude → ['claude', '-p', '--output-format', 'text']"
```

### パターン 3: Fixture 汚染

**症状**: テスト間でデータが共有されていて、あるテストが作った fixture が別のテストの前提を壊す。

**具体例**:
- テスト A が `status: failed` の project を作成
- テスト B が「初期状態」を確認するが、テスト A の failed project が最初に出てくる

**ガイドライン**:
- 各テストは **自分専用の fixture を作り、他のテストの fixture に依存しない**
- DB / ストアを共有する場合は、テストごとに namespace (project name 等) を分ける
- 「一覧の先頭に何が来るか」に依存するテストは、fixture の順序を制御する

```yaml
# 良い例: fixture 分離を前提にしたケース
- id: "E-INIT-002"
  layer: "e2e"
  title: "fixture 汚染がない状態で初期表示を確認"
  spec_file: "e2e/init.spec.ts"
  assertions:
    - "他テストの failed fixture が初期表示に出ない"
```

### パターン 4: 設定値の env override が未検証

**症状**: 環境変数で上書きできる設定があるが、上書き時の挙動をテストしていない。

**具体例**:
- `AI_MOCK_CANVAS_CODEX_ARGS` で CLI 引数を上書きできる
- JSON 配列と quoted string の両方を受け付けるはずだが、パースの境界ケースが未テスト

**ガイドライン**:
- env override があるなら、**override 時の挙動を unit でテストする**
- 「デフォルト値」と「override 値」の 2 ケースを最低限持つ

```yaml
- id: "U-CONFIG-001"
  layer: "unit"
  title: "env override のパース"
  assertions:
    - "JSON 配列 → 正しくパースされる"
    - "quoted string → 正しく split される"
    - "未設定 → デフォルト値が使われる"
```

### パターン 5: エラー表示の E2E が正常系 fixture に依存

**症状**: エラー表示のテストが「正常に作ったカードを PATCH で failed にする」という回りくどい手順に依存していて、PATCH の仕様が変わるとエラー表示テストも壊れる。

**ガイドライン**:
- エラー表示の E2E は、**最初から失敗する fixture を直接作る**方が安定する
- 「正常→異常にする」手順は integration 層で検証し、E2E では結果だけ見る

```yaml
# 良い例: E2E は失敗 fixture を直接 seed する
- id: "E-ERROR-001"
  layer: "e2e"
  title: "failed カードの表示"
  spec_file: "e2e/error-display.spec.ts"
  procedures: ["PROC-SEED-FAILED"]
  assertions:
    - "failed カードにエラーメッセージが表示される"
    - "Retry ボタンが表示される"

# 正常→failed の遷移は integration で
- id: "I-CARD-010"
  layer: "integration"
  title: "PATCH で status を failed に変更"
  assertions:
    - "completed → failed: PATCH 200"
    - "response.errorMessage が設定される"
```

### パターン 6: 非同期完了の待機が不十分

**症状**: 生成・リトライ等の非同期処理が完了する前にアサーションが走り、たまに落ちる (flaky)。

**ガイドライン**:
- polling / waitFor 系の待機を procedures に固定する
- 「カード数が N になるまで待つ」等の具体的な完了条件をアサーションに書く
- `setTimeout` や固定 sleep に依存しない

```yaml
- id: "E-FLOW-002"
  layer: "e2e"
  title: "生成完了を待ってからカード数を確認"
  procedures: ["PROC-WAIT-CARDS"]
  assertions:
    - "waitForCardCount(N) でカード数が一致するまで待機"
    - "status が completed になるまで polling する"
```

---

## パターン集の活用方法

1. **YAML 設計時**: ケースを書き終えたら、上記パターンに照らして漏れがないか確認する
2. **`e2e-spec validate` の拡張 (将来)**: パターンに対応する lint ルールを追加する
   - 例: 「e2e 層に初期状態テストが 1 件もない」→ warning
   - 例: 「全 E2E が query param 付き」→ warning
3. **プロジェクト固有のパターン追加**: `test-plan.yaml` と同じディレクトリに `pitfalls.yaml` を置いて、プロジェクト固有の盲点を記録する
