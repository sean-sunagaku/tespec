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
  "YAML で仕様", "どんな画面が必要か", "何ができるか整理"
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
Step 6: バリデーション
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

### Step 2: 各画面/機能の操作を洗い出す

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

#### 層 3: 入力データの異常（そもそも前提が壊れている場合）

**ここが漏れやすい。** 機能が依存する入力やデータソースが不正な場合を洗い出す:

- **ファイルが存在しない**: 設定ファイル、データファイルがパスに見つからない
- **ファイルが壊れている**: 構文エラー、スキーマ不正、エンコーディング不正
- **必須引数が未指定**: CLI フラグ、API パラメータの欠落
- **依存モジュールのエラー**: 内部で呼ぶ関数がエラーを返した場合のハンドリング

```
例: check-coverage コマンドの洗い出し

層 1 (操作):
  - 正しい config でカバレッジチェック → OK 表示
  - テストファイルが不足 → ERROR 表示

層 2 (異常系):
  - case 数が不一致 → WARN 表示

層 3 (入力データ異常):              ← ここが漏れた
  - config.yaml が存在しない → エラー終了
  - YAML 構文が壊れている → エラー終了
  - YAML スキーマが不正 → エラー終了
```

### Step 3: 画面遷移を整理する

操作の中から画面遷移を抜き出す。双方向遷移（行って戻る）も忘れない。

```
dashboard → detail    (項目をクリック)
detail → dashboard    (戻るボタン)
```

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

---

## Unit YAML の作り方

Unit YAML はソースコードのファイル単位で作成する。ディレクトリ構成もソースコードのリポジトリ構造に合わせる。

### 原則

- 1 ソースファイル = 1 Unit YAML
- units_dir 配下のディレクトリ構成を src/ のディレクトリ構成に合わせる
- unit ID はファイル名ベースで付ける
- method はそのファイルの公開関数やクラスメソッドに対応させる

### ディレクトリ構成の例

ソースコードが以下の場合:
```text
src/
├── core/
│   ├── parser.ts
│   ├── schema.ts
│   └── validator.ts
└── generators/
    ├── registry.ts
    └── screen/
        └── playwright.ts
```

Unit YAML は以下のように配置する:
```text
docs/tespec/units/
├── core/
│   ├── parser.yaml
│   ├── schema.yaml
│   └── validator.yaml
└── generators/
    ├── registry.yaml
    └── screen/
        └── playwright.yaml
```

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
          - units が ParsedProject に含まれる
        type: normal
      - action: 存在しないディレクトリを指定する
        expect: エラーが errors に含まれる
        type: error
      - action: screens が 0 件のプロジェクトをパースする
        expect: screens が空配列で返る
        type: boundary
```

- expect は文字列でも配列でも書ける。検証項目が複数あるなら配列にする
- type は normal / error / boundary の 3 種類。各 method に最低 1 つずつ含めると warning を避けられる

### CRITICAL: 統合ポイントの異常系を漏らさない

Unit YAML はコアモジュールのロジックだけでなく、**そのモジュールを呼び出すコマンド層の異常系**もカバーする必要がある。

コマンドの処理フローを書き出し、各ステップの異常系を洗い出す:

```
例: check-coverage コマンド
  1. parseProject(configPath)  ← config が存在しない / YAML が壊れている / スキーマ不正
  2. checkCoverage(...)        ← テストファイルなし / case 数不一致
  3. 結果出力                  ← 出力フォーマットのテスト
```

**チェックリスト（コマンド層の異常系）:**
- 必須引数が未指定の場合
- 入力ファイルが存在しない場合（config.yaml、ディレクトリ）
- 入力ファイルが壊れている場合（YAML 構文エラー、スキーマ不正）
- 依存する既存モジュール（parseProject 等）がエラーを返す場合
- exit code が仕様通りか（0/1）

### TDD ファースト

tespec YAML から実装する際は、テストを全て先に作成してから実装コードを書く。BE も FE も同様。

1. tespec YAML でテスト仕様を定義する
2. `tespec generate` でテストスケルトンを生成する
3. テストの中身を実装する（この時点でテストは RED）
4. 実装コードを書いて GREEN にする

この順序を守ることで、仕様通りの実装が担保される。

### 画面を伴う実装には必ず Viewer テストを作る

Viewer コンポーネントを追加・変更する場合は、必ず対応するテストファイルを作成する。

- 新しい Detail コンポーネントを追加 → `tests/viewer/viewer-<name>.test.tsx` を作成
- 対応する Screen YAML spec を `docs/tespec/screens/viewer/` に追加
- `tests/viewer/viewer-spec-coverage.test.ts` がテストと YAML spec の対応を自動検証するため、片方だけ作ると CI で検出される

例: `WorkflowDetail.tsx` を追加した場合
- テスト: `tests/viewer/viewer-workflow-detail.test.tsx`
- YAML spec: `docs/tespec/screens/viewer/viewer-workflow-detail.yaml`

---

## File Layout

```text
docs/tespec/
├── config.yaml
├── screens/
│   ├── <feature>/          ← 機能別サブディレクトリ対応
│   │   └── <screen>.yaml
│   └── <screen>.yaml
├── units/
│   ├── <src-dir>/          ← ソースコードのディレクトリ構成に合わせる
│   │   └── <file>.yaml
│   └── <file>.yaml
└── setups/
    └── <setup>.yaml
```

screens_dir / units_dir 配下のサブディレクトリは再帰的にスキャンされる。

## YAML 特殊文字に注意

YAML の値に `*`, `"..."`, `//`, `#`, `: `, `[`, `]` が含まれると構文エラーになる。
**クォートで囲むか、表現を日本語に変えて回避する。**

```yaml
# BAD: * がアンカー参照と誤認される
- action: *Tests.swift ファイルを収集する
# GOOD: 表現を変える
- action: Tests.swift パターンのファイルを収集する

# BAD: 二重引用符の入れ子
- action: "// TODO: implement" を検出する
# GOOD: 表現を変える
- action: TODO implement コメントを検出する
```

詳細は `rules/writing-guide.md` の「YAML 特殊文字の注意」セクションを参照。

## References

- `rules/writing-guide.md`: 画面遷移・操作の洗い出し手順、命名方針、YAML の書き方、YAML 特殊文字の注意
- `rules/screen-schema.md`: screen YAML の例と field guide
- `rules/case-schema.md`: case の例、操作と遷移の書き方、網羅性チェックリスト
- `rules/setup-schema.md`: setup の例と field guide
- `rules/workflow-schema.md`: workflow YAML の例と field guide（複数画面をまたぐ E2E シナリオ）
- `rules/validation-rules.md`: validate コマンド、参照整合性、warning 条件
