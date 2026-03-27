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

### Step 2: 各画面の操作を洗い出す

画面ごとに「ユーザーが何をするか」を **具体的な動詞** で書き出す。
以下のチェックリストを使って漏れを防ぐ:

- **表示**: 画面を開いたときに何が見えるか
- **入力**: フォーム入力、テキスト入力、選択
- **操作**: ボタンクリック、スワイプ、ドラッグ
- **遷移**: 他の画面への移動
- **更新**: データが変わったときの表示更新
- **エラー**: ネットワーク切断、バリデーションエラー（type: error）
- **境界**: 0件、上限、長い文字列（type: boundary）

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
スキーマの詳細は以下を参照:

- `rules/screen-schema.md` — screen YAML の必須フィールド
- `rules/case-schema.md` — case の書き方（steps の具体性、navigates_to、操作の網羅性）
- `rules/setup-schema.md` — setup の書き方
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

## File Layout

```text
docs/tespec/
├── config.yaml
├── screens/
│   ├── <feature>/          ← 機能別サブディレクトリ対応（再帰スキャン）
│   │   └── <screen>.yaml
│   └── <screen>.yaml
└── setups/
    └── <setup>.yaml
```

screens_dir 配下のサブディレクトリは再帰的にスキャンされる。機能別に整理できる。

## References

- `rules/writing-guide.md`: 画面遷移・操作の洗い出し手順、命名方針、YAML の書き方
- `rules/screen-schema.md`: screen YAML の例と field guide
- `rules/case-schema.md`: case の例、操作と遷移の書き方、網羅性チェックリスト
- `rules/setup-schema.md`: setup の例と field guide
- `rules/validation-rules.md`: validate コマンド、参照整合性、warning 条件
