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
**3 層チェックリスト**で漏れを防ぐ:

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
2. Step 2 の「3層チェックリスト」に戻って操作を再洗い出しする
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

## YAML 特殊文字に注意

YAML の値に `*`, `"..."`, `//`, `#`, `: `, `[`, `]` が含まれると構文エラーになる。
**クォートで囲むか、表現を日本語に変えて回避する。**

詳細は `rules/writing-guide.md` の「YAML 特殊文字の注意」セクションを参照。

## References

- `rules/writing-guide.md`: 画面遷移・操作の洗い出し手順、命名方針、YAML の書き方、YAML 特殊文字の注意
- `rules/screen-schema.md`: screen YAML の例と field guide
- `rules/case-schema.md`: case の例、操作と遷移の書き方、網羅性チェックリスト
- `rules/setup-schema.md`: setup の例と field guide
- `rules/workflow-schema.md`: workflow YAML の例と field guide（複数画面 E2E シナリオ）
- `rules/validation-rules.md`: validate コマンド、参照整合性、warning 条件
