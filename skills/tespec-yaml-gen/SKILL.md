---
name: tespec-yaml-gen
description: >
  画面遷移・ユーザー操作を対話で洗い出し、tespec YAML として定義するスキル。
  「何の画面があって、各画面で何ができて、どこに遷移するか」を先に整理してから YAML に落とす。
  YAML をいきなり書かない。まず画面と操作を洗い出す。これが最も重要なステップ。
  Use when: 画面仕様を作りたい、画面の操作を洗い出したい、画面遷移を整理したい、
  tespec YAML を書きたい、テスト仕様を作りたい、機能から画面定義に落としたい。
  Triggers: "tespec YAML", "画面仕様", "画面の操作", "操作を洗い出す", "画面遷移",
  "tespec-yaml-gen", "screen yaml", "case を書きたい", "画面定義", "テスト仕様",
  "YAML 仕様", "テストケース定義"
---

# tespec-yaml-gen — 画面遷移・操作の洗い出し → YAML 定義

## 核心: YAML を書く前に、画面と操作を洗い出す

YAML はただのフォーマット。本当に大事なのは「何の画面があって、各画面で何ができて、どこに遷移するか」を明確にすること。

**このスキルの最重要ワークフロー:**

```
Step 1: 画面を列挙する
  ↓
Step 2: 各画面の操作を洗い出す（正常系・異常系・境界値）
  ↓
Step 3: 画面遷移を整理する（navigates_to）
  ↓
Step 4: 前提条件を setup に抽出する
  ↓
Step 5: YAML に落とす（ここでやっとスキーマを見る）
  ↓
Step 6: バリデーション → warning を 0 件にする
```

Step 1〜4 が最も重要。Step 5〜6 は機械的な作業。
詳細は `rules/writing-guide.md` の「画面遷移と操作の洗い出し」セクションを参照。

---

## Step 1〜4: 画面・操作・遷移の洗い出し

### Step 1: 画面を列挙する

機能に必要な画面を全てリストアップする。

| 画面 ID | タイトル | Route | 目的 |
|---------|---------|-------|------|
| dashboard | ダッシュボード | / | 一覧表示 |
| detail | 詳細画面 | /#/items/:id | 個別表示 |

### Step 2: 各画面の操作を洗い出す

画面ごとに「ユーザーが何をするか」を **具体的な動詞** で書き出す。
**4 層チェックリスト**で漏れを防ぐ:

#### 層 1: ユーザー操作（その画面で何ができるか）

- **表示**: 画面を開いたときに何が見えるか
- **入力**: フォーム入力、テキスト入力、選択
- **操作**: ボタンクリック、スワイプ、ドラッグ
- **遷移**: 他の画面への移動
- **更新**: データが変わったときの表示更新

#### 層 2: 異常系・境界値（何が壊れるか）

- **バリデーションエラー**: 不正な入力値、必須項目の未入力（type: error）
- **外部エラー**: ネットワーク切断、API エラー、タイムアウト（type: error）
- **境界値**: 0件、上限、空文字、超長文字列（type: boundary）
- **レイアウト重なり**: 座標計算を伴う機能（グラフ、チャート、ドラッグ配置等）では要素同士の重なりをテストする（type: boundary）

#### 層 3: 入力データの異常（そもそも前提が壊れている場合）

**ここが漏れやすい。** 機能が依存する入力やデータソースが不正な場合を洗い出す:

- **ファイルが存在しない**: 設定ファイル、データファイルがパスに見つからない
- **ファイルが壊れている**: 構文エラー、スキーマ不正、エンコーディング不正
- **必須引数が未指定**: CLI フラグ、API パラメータの欠落
- **依存モジュールのエラー**: 内部で呼ぶ関数がエラーを返した場合のハンドリング

#### 層 4: ランタイム・結合エラー（実際に動かすと壊れるもの）

**ブラウザで動かすまで気づけない問題をここで先に洗い出す。**

画面（screen）とロジック（unit）の間にある「結合点」を全てリストアップし、それぞれのエラーケースを YAML に定義する:

##### API Route / サーバーエンドポイント

フロントエンドが呼ぶ全ての API Route に対して unit YAML を作成する:

- **正常なリクエスト**: 期待するレスポンスが返るか
- **リクエストボディが空 / 不正**: 400 エラーが返るか
- **必須フィールドが欠落**: 400 エラーが返るか
- **外部 API エラー**: 500 エラーとエラーメッセージが返るか
- **認証 / API キー未設定**: 500 エラーが返るか（環境変数依存）
- **タイムアウト**: 適切なエラーが返るか
- **レスポンス形式**: Content-Type, ステータスコード, ボディの形式が正しいか

##### 環境依存

- **環境変数が未設定**: API キー、DB 接続文字列、外部サービス URL
- **ブラウザ API 非対応**: File System Access API, Web Crypto API 等
- **SSR / CSR の境界**: `window` や `document` にアクセスするコードがサーバーで動く場合

##### フロントエンド ↔ バックエンド結合

画面（screen YAML）で「API を呼ぶ」操作がある場合、対応する API Route の unit YAML が存在するか確認する:

| screen YAML の操作 | 必要な unit YAML |
|-------------------|----------------|
| メッセージを送信する → AI 応答 | POST /api/chat の unit |
| 保存ボタンをクリック → ファイル保存 | saveToFile の unit |
| 読み込みボタン → ファイル読み込み | loadFromFile の unit |

**チェックリスト**: screen YAML の全 case をスキャンして、API 通信を伴う操作を抽出する。対応する API Route / サーバー関数の unit YAML がなければ追加する。

##### 外部サービス呼び出しクライアント

外部サービス（AI API、DB、外部 API）を呼び出すクライアントモジュールは、結合部分が壊れやすいため必ず unit YAML を作成する:

- **呼び出しインターフェースが正しいか**: 引数・オプション・フラグの渡し方
- **正常応答のパース**: レスポンスが期待する形式でデシリアライズされるか
- **プロセス/接続の異常終了**: exit code 非ゼロ、接続切断
- **プロセス/コマンドが見つからない**: ENOENT、PATH 未設定
- **出力が期待する形式でない**: JSON でない、スキーマ不一致
- **ストリーミング時の部分データ**: 非 JSON 行が混在、途中切断
- **タイムアウト**: 長時間応答なし

例: Claude Code SDK (`claude -p`) を呼ぶクライアントの場合

```yaml
unit: claude-client
methods:
  - method: callClaude
    cases:
      - action: プロンプトを渡して応答を取得する
        expect: resultに応答テキストが含まれる
        type: normal
      - action: claude CLIが異常終了する場合
        expect: エラーがスローされる
        type: error
      - action: claude CLIが見つからない場合
        expect: spawn失敗のエラーがスローされる
        type: error
      - action: 出力がJSON形式でない場合
        expect: パースエラーがスローされる
        type: error
```

**外部サービスクライアントの unit テストはモックで高速に（CI 向け）、E2E テストは実呼び出しで確実に（ローカル向け）の 2 層で網羅する。**

### Step 3: 画面遷移を整理する

操作の中から画面遷移を抜き出す。双方向遷移（行って戻る）も忘れない。

### Step 4: 前提条件を setup に抽出する

複数画面で共通の前提条件を setup として切り出す。

---

## Step 5: YAML に落とす

洗い出した操作を 1 つ = 1 case として YAML に書く。
複数画面をまたぐシナリオは workflow YAML に書く。
スキーマの詳細は以下を参照:

- `rules/screen-schema.md` — screen YAML の必須フィールド
- `rules/case-schema.md` — case の書き方（steps の具体性、navigates_to、操作の網羅性）
- `rules/setup-schema.md` — setup の書き方
- `rules/workflow-schema.md` — workflow YAML の書き方（複数画面 E2E シナリオ）
- `rules/writing-guide.md` — 命名方針、`use:<setup_id>` の扱い

## Step 6: バリデーション

```bash
# 単体の YAML 確認
tespec validate --file <path>

# 参照整合性（given, navigates_to の参照先が存在するか）
tespec validate --config <path-to-config.yaml>
```

- warning だけなら exit code は 0、error があると exit code は 1

### CRITICAL: warning が出たら必ず対処する

バリデーションで warning が出た場合、**無視せず YAML を見直す**。

| warning | 意味 | 対処法 |
|---------|------|--------|
| `異常系 (type: error) が 0 件` | その method/screen に error case がない | 入力値の異常（不正な値、未指定、存在しないリソース）を洗い出して error case を追加 |
| `境界値 (type: boundary) が 0 件` | その method/screen に boundary case がない | 0件、上限、空文字、超長文字列などの境界条件を洗い出して boundary case を追加 |

**見直しの手順:**
1. warning メッセージの対象ファイル・method を確認する
2. Step 2 の「4層チェックリスト」に戻って操作を再洗い出しする
3. 特に **層 2（異常系・境界値）** と **層 3（入力データの異常）** を重点的にチェック
4. 不足している type の case を追加する
5. 再度 `tespec validate` で warning が消えたことを確認する

**warning を 0 件にしてから YAML 完成とする。**

---

## Unit YAML の作り方

Unit YAML はソースコードのファイル単位で作成する。ディレクトリ構成もソースコードのリポジトリ構造に合わせる。

### 原則

- 1 ソースファイル = 1 Unit YAML
- units_dir 配下のディレクトリ構成を src/ のディレクトリ構成に合わせる
- unit ID はファイル名ベースで付ける
- method はそのファイルの公開関数やクラスメソッドに対応させる

### Unit YAML の書き方

```yaml
unit: parser
title: YAML パーサー
methods:
  - method: parseProject
    cases:
      - action: 有効な config で全 spec をパースする
        expect:
          - screens が ParsedProject に含まれる
          - setups が ParsedProject に含まれる
        type: normal
      - action: 存在しないディレクトリを指定する
        expect: エラーが errors に含まれる
        type: error
      - action: screens が 0 件のプロジェクトをパースする
        expect: screens が空配列で返る
        type: boundary
```

### CRITICAL: 統合ポイントの異常系を漏らさない

Unit YAML はコアモジュールのロジックだけでなく、**そのモジュールを呼び出すコマンド層の異常系**もカバーする必要がある。

**チェックリスト（コマンド層の異常系）:**
- 必須引数が未指定の場合
- 入力ファイルが存在しない場合（config.yaml、ディレクトリ）
- 入力ファイルが壊れている場合（YAML 構文エラー、スキーマ不正）
- 依存する既存モジュール（parseProject 等）がエラーを返す場合
- 正常系でも出力フォーマットが想定通りか（OK/WARN/ERROR の表示）
- exit code が仕様通りか（0/1）

### TDD ファースト

tespec YAML から実装する際は、テストを全て先に作成してから実装コードを書く。BE も FE も同様。

1. tespec YAML でテスト仕様を定義する
2. `tespec generate` でテストスケルトンを生成する（**必ず実ファイルを生成。--dry-run は使わない**）
3. テストの中身を実装する（この時点でテストは RED）
4. 実装コードを書いて GREEN にする

### テストスケルトン生成

```bash
# 全スペックを一括生成
tespec generate -c <config-path> -t vitest -o <output-dir>

# 特定のスペックのみ生成
tespec generate -c <config-path> --screen <screen-id> -t vitest -o <output-dir>
tespec generate -c <config-path> --unit <unit-id> --unit-target vitest -o <output-dir>
tespec generate -c <config-path> --workflow <workflow-id> --workflow-target playwright -o <output-dir>
```

### 画面を伴う実装には必ず Viewer テストを作る

Viewer コンポーネントを追加・変更する場合は、必ず対応するテストファイルを作成する。

---

## File Layout

```text
docs/tespec/
├── config.yaml
├── screens/
│   ├── <feature>/
│   │   └── <screen>.yaml
│   └── <screen>.yaml
├── units/
│   ├── <src-dir>/
│   │   └── <file>.yaml
│   └── <file>.yaml
├── setups/
│   └── <setup>.yaml
└── workflows/
    └── <workflow>.yaml
```

screens_dir / units_dir / workflows_dir 配下のサブディレクトリは再帰的にスキャンされる。

### テストディレクトリも同じ構成にする

テストファイルは tespec YAML のディレクトリ構成をそのままミラーする（`/tespec-imp` 参照）:

```text
tests/
├── screens/          ← docs/tespec/screens/ と同じ構造
├── units/            ← docs/tespec/units/ と同じ構造
├── workflows/        ← docs/tespec/workflows/ と同じ構造
├── __mocks__/
└── setup.ts
```

YAML を追加・移動したら、対応するテストファイルも同じ位置に追加・移動する。

## YAML 特殊文字に注意

YAML の値に `*`, `"..."`, `//`, `#`, `: `, `[`, `]` が含まれると構文エラーになる。
**クォートで囲むか、表現を日本語に変えて回避する。**

詳細は `rules/writing-guide.md` の「YAML 特殊文字の注意」セクションを参照。

---

## YAML は Single Source of Truth

テスト仕様の正本は常に YAML。テストコードは YAML の派生物。

### 原則

- **仕様変更は YAML から**: テストの `action` や `expect` を修正したくなったら、まず YAML を修正する
- **YAML → テスト の一方向フロー**: テスト側で先に変更して YAML に戻す流れは禁止
- **drift（乖離）はバグ**: YAML とテストの内容がズレている状態は仕様バグとして扱う

### YAML 変更 → テスト同期フロー

YAML を変更したら、テストのスケルトン構造をそれに合わせて同期する。
テスト実装コード（`it()` の中身）は保持し、構造（`describe`/`it` のタイトル）だけを YAML に追従させる。

```
1. YAML を修正する（case 追加・削除・変更）
   ↓
2. tespec validate で warning 0 件を確認
   ↓
3. 既存テストとの diff を確認する（後述の手順）
   ↓
4. テストのスケルトン構造を YAML に合わせて修正する
   - 追加された case → it() ブロックを追加（// TODO: implement）
   - 削除された case → it() ブロックを削除
   - 変更された action/expect → it() のタイトルを修正（中身は保持）
   ↓
5. テスト実行で確認
```

### YAML diff → テスト同期の手順

YAML を変更した後、以下の手順で既存テストとの差分を特定する:

**Step 1: YAML の変更内容を確認する**
```bash
git diff docs/tespec/
```

**Step 2: 対応するテストファイルを特定する**
- screen YAML `screens/xxx.yaml` → `tests/screens/xxx.test.tsx`
- unit YAML `units/xxx.yaml` → `tests/units/xxx.test.ts`
- workflow YAML `workflows/xxx.yaml` → `tests/workflows/xxx.spec.ts`

**Step 3: 差分の種類ごとに対応する**

| YAML の変更 | テスト側の対応 |
|------------|-------------|
| case 追加 | `it("新しいaction → 新しいexpect", () => { // TODO: implement })` を追加 |
| case 削除 | 対応する `it()` ブロックを削除 |
| action 変更 | `it()` の第1引数（テスト名）を修正。中身はそのまま |
| expect 変更 | `it()` のテスト名を修正。中身のアサーションもexpectに合わせて修正 |
| type 変更 | `describe("異常系")` / `describe("境界値")` 間でブロックを移動 |
| screen/unit 追加 | `tespec generate` で新スケルトン生成。既存ファイルには触れない |

### いつ YAML を変更するか

| 状況 | 対応 |
|------|------|
| 新しい操作・画面を追加したい | YAML に case/screen を追加 → テスト同期 |
| テスト名(action)を修正したい | YAML の action を修正 → テストの it() タイトルを修正 |
| expect を修正したい | YAML の expect を修正 → テストのアサーションを修正 |
| 不要な case を削除したい | YAML から case を削除 → テストの it() を削除 |
| テスト実装中に仕様の漏れに気づいた | **作業を止めて** YAML に case を追加 → validate → テスト同期 → 作業再開 |

### CRITICAL: テスト実装中の仕様変更

テスト（/tespec-imp Phase 2）や実装（Phase 4）の最中に仕様の修正が必要だと気づいた場合:

1. **作業を一旦止める**
2. YAML を修正する
3. `tespec validate` で確認する
4. 上記の「YAML diff → テスト同期の手順」でテストを同期する
5. 元の作業に戻る

「後で YAML に反映する」は忘れるのでやらない。**気づいた瞬間に YAML を直す。**

---

## References

- `rules/writing-guide.md`: 画面遷移・操作の洗い出し手順、命名方針、YAML の書き方、YAML 特殊文字の注意
- `rules/screen-schema.md`: screen YAML の例と field guide
- `rules/case-schema.md`: case の例、操作と遷移の書き方、網羅性チェックリスト
- `rules/setup-schema.md`: setup の例と field guide
- `rules/workflow-schema.md`: workflow YAML の例と field guide（複数画面 E2E シナリオ）
- `rules/validation-rules.md`: validate コマンド、参照整合性、warning 条件
