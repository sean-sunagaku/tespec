# Step 2: アーキテクチャパターン比較

**タスク ID**: 6
**担当**: architecture-lead
**ステータス**: completed

---

## 前提条件の再確認

- **v1 スコープ**: `validate` + `generate` の2コマンドのみ
- **設計哲学**: シンプル最優先（YAGNI）
- **核心的価値**: バリデーションの信頼性
- **利用形態**: OSS（npm 公開）、コントリビューターが読める構造が必要
- **確定スタック**: TypeScript / commander / yaml / zod v4 / picocolors / cli-table3 / tsup / Vitest

---

## Phase 2a: 10案列挙

### 案 1: Flat Script（フラットスクリプト）

```
src/
├── cli.ts           # commander セットアップ + 全ロジック
├── validate.ts      # バリデーション関数群
└── generate.ts      # 生成関数群
```

コマンドハンドラーと処理ロジックを同一ファイルまたは隣接ファイルに直書き。レイヤーなし。

### 案 2: 3層構造（CLI / Core / Utils）

Devil's Advocate が推奨するミニマル構成。

```
src/
├── cli.ts           # エントリーポイント（commander）
├── core/
│   ├── schema.ts    # Zod スキーマ + 型定義
│   ├── parser.ts    # YAML → 型付きオブジェクト
│   ├── validator.ts # 参照整合性チェック
│   └── generator.ts # テストスケルトン生成
└── utils/
    └── output.ts    # picocolors / cli-table3 ラッパー
```

3層（CLI / Core / Utils）のみ。commands/ ディレクトリは持たない。

### 案 3: Layered Architecture（4層）

Platform Expert が示した推奨構成。

```
src/
├── cli.ts
├── commands/        # コマンドハンドラー（薄いルーティング層）
│   ├── validate.ts
│   └── generate.ts
├── core/            # ビジネスロジック
│   ├── schema.ts
│   ├── parser.ts
│   ├── validator.ts
│   └── generator.ts
└── utils/
    └── output.ts
```

CLI → Commands → Core → Utils の4層構造。コマンドと処理ロジックが明確に分離。

### 案 4: Pipes & Filters（パイプライン）

```
src/
├── cli.ts
├── pipeline/
│   ├── load.ts      # YAML 読み込みフィルター
│   ├── parse.ts     # パースフィルター
│   ├── validate.ts  # バリデーションフィルター
│   └── report.ts    # 出力フィルター
└── types.ts
```

YAML → Load → Parse → Validate → Report の線形パイプライン。データが各フィルターを順番に通過。

### 案 5: Feature Module（機能モジュール）

```
src/
├── cli.ts
├── validate/
│   ├── index.ts     # コマンドエントリ
│   ├── parser.ts
│   ├── validator.ts
│   └── reporter.ts
├── generate/
│   ├── index.ts
│   ├── parser.ts
│   └── generator.ts
└── shared/
    ├── schema.ts
    └── output.ts
```

コマンド単位で全処理をまとめる（Vertical Slice 的）。shared に共通部分。

### 案 6: Vertical Slice Architecture

```
src/
├── cli.ts
├── features/
│   ├── validate/
│   │   ├── handler.ts   # CLI → Core の接続
│   │   ├── usecase.ts   # バリデーションユースケース
│   │   └── reporter.ts
│   └── generate/
│       ├── handler.ts
│       ├── usecase.ts
│       └── writer.ts
└── shared/
    ├── schema.ts
    ├── parser.ts
    └── output.ts
```

機能スライス（validate / generate）ごとに handler → usecase → infrastructure を縦に束ねる。

### 案 7: Clean Architecture（軽量版）

```
src/
├── cli.ts                  # Presentation
├── adapters/
│   ├── cli/
│   │   ├── validate.ts
│   │   └── generate.ts
│   └── fs/
│       └── yaml-loader.ts
├── usecases/
│   ├── validate-spec.ts
│   └── generate-tests.ts
└── entities/
    ├── screen.ts
    └── setup.ts
```

依存関係が内側へのみ向く。entities は何にも依存しない。

### 案 8: Hexagonal Architecture（ポート＆アダプター）

```
src/
├── cli.ts
├── ports/
│   ├── in/
│   │   ├── validate-port.ts
│   │   └── generate-port.ts
│   └── out/
│       └── file-system-port.ts
├── core/
│   ├── validate-service.ts
│   └── generate-service.ts
└── adapters/
    ├── commander-adapter.ts
    └── node-fs-adapter.ts
```

ポートを介してコアをアダプターから切り離す。テスト時はポートをモック化。

### 案 9: Command Pattern（コマンドオブジェクト）

```
src/
├── cli.ts
├── commands/
│   ├── base-command.ts     # 抽象基底クラス
│   ├── validate-command.ts # Command を継承
│   └── generate-command.ts
├── core/
│   ├── schema.ts
│   ├── parser.ts
│   └── validator.ts
└── utils/
    └── output.ts
```

各 CLI コマンドを Command オブジェクト（`execute()` メソッド）としてカプセル化。

### 案 10: Modular Monolith（モジュラーモノリス）

```
src/
├── cli.ts
├── modules/
│   ├── spec/           # 仕様読み込みモジュール
│   │   ├── index.ts    # パブリック API
│   │   ├── loader.ts
│   │   └── schema.ts
│   ├── validation/     # バリデーションモジュール
│   │   ├── index.ts
│   │   └── rules.ts
│   └── generation/     # 生成モジュール
│       ├── index.ts
│       └── template.ts
└── shared/
    └── output.ts
```

モジュール間はパブリック API（index.ts）経由でのみ通信。内部実装を隠蔽。

---

## Phase 2b: 5軸スコアリング

**スコア基準**: 1（低）〜 5（高）
- 保守性・拡張性: v2 コマンド追加への対応容易さ
- テスト容易性: ユニットテスト・統合テストの書きやすさ
- スタック適合性: TypeScript/Node.js CLI との相性
- 学習コスト: OSSコントリビューターが理解できるか（高=低コスト=わかりやすい）
- シンプルさ: ファイル数・抽象度の少なさ（高=シンプル）

| # | パターン | 保守性・拡張性 | テスト容易性 | スタック適合性 | 学習コスト | シンプルさ | 合計 |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Flat Script | 1 | 2 | 3 | 5 | 5 | **16** |
| 2 | 3層構造（CLI/Core/Utils） | 3 | 4 | 5 | 5 | 5 | **22** |
| 3 | Layered（4層） | 4 | 5 | 5 | 4 | 4 | **22** |
| 4 | Pipes & Filters | 3 | 3 | 3 | 3 | 3 | **15** |
| 5 | Feature Module | 4 | 4 | 4 | 3 | 3 | **18** |
| 6 | Vertical Slice | 4 | 4 | 3 | 3 | 2 | **16** |
| 7 | Clean Architecture（軽量） | 4 | 5 | 3 | 2 | 2 | **16** |
| 8 | Hexagonal | 3 | 5 | 2 | 1 | 1 | **12** |
| 9 | Command Pattern | 4 | 4 | 4 | 3 | 3 | **18** |
| 10 | Modular Monolith | 4 | 4 | 4 | 3 | 2 | **17** |

### スコアリング根拠

**案 1（Flat Script, 16点）**
- 保守性1: v2 コマンド追加時にファイルが肥大化し、責務が混在する
- テスト容易性2: ロジックがコマンドと混在するとユニットテストが困難
- シンプルさ5: ファイル数が最小

**案 2（3層構造, 22点）**
- 保守性3: core/ にロジックが集まるためコマンド追加は容易だが、コマンドハンドラーが cli.ts に集まりやすい
- テスト容易性4: core/ を直接テストできる。CLI の統合テストは別途必要
- スタック適合性5: TypeScript CLI の慣習と完全一致
- 学習コスト5: ファイル構造が直感的、説明不要
- シンプルさ5: ファイル総数が最小クラス（7-8ファイル）

**案 3（Layered 4層, 22点）**
- 保守性4: commands/ で各コマンドを独立管理。v2 コマンド追加は新ファイル追加だけ
- テスト容易性5: commands/ はモック不要でハンドラーテスト可能。core/ は完全独立でユニットテスト可能
- スタック適合性5: Platform Expert の推奨構成。CLI ツールの標準パターン
- 学習コスト4: commands/ と core/ の役割が明確。わずかに層が増えるが自明
- シンプルさ4: ファイル数 9-11 程度。過剰な抽象化なし

**案 4（Pipes & Filters, 15点）**
- スタック適合性3: Node.js Transform Stream との親和性はあるが、YAML バリデーションはストリームより一括処理が適切
- シンプルさ3: パイプライン概念が直感的でない場面もある

**案 5（Feature Module, 18点）**
- 保守性4: 新コマンドは新ディレクトリ追加で対応。既存への影響ゼロ
- テスト容易性4: 機能ごとにテストが独立
- 学習コスト3: validate/ と generate/ でパーサーが重複する傾向
- シンプルさ3: shared/ の境界判断が難しくなりがち

**案 6（Vertical Slice, 16点）**
- features/ の中にさらに handler/usecase が入るため、v1 の規模には過剰な深さ

**案 7（Clean Architecture 軽量版, 16点）**
- テスト容易性5: 依存関係の内向きルールでテストは非常に書きやすい
- 学習コスト2: entities/adapters/usecases の概念が OSS コントリビューターに伝わりにくい
- v1 の CLI ツールに Clean Architecture は over-engineering

**案 8（Hexagonal, 12点）**
- ports/ という概念が CLI ツールには不自然
- 入力チャンネルが CLI のみなので、アダプター分離のメリットが薄い

**案 9（Command Pattern, 18点）**
- コマンドオブジェクトのパターンは commander と概念が重複
- 抽象基底クラスは TypeScript では interface より class 継承コストが発生

**案 10（Modular Monolith, 17点）**
- modules/index.ts によるカプセル化は v2 以降で価値を発揮するが v1 では早すぎる

---

## Phase 2c: Top 3 詳細分析

合計点が同点だった案 2 と案 3 を中心に、v1 スコープへの適合度で Top 3 を絞り込む。

### 推奨順位

**1位: 案 3（Layered 4層）- 22点**
**2位: 案 2（3層構造）- 22点**
**3位: 案 5（Feature Module）- 18点** ← v2 以降の拡張で価値が増す

---

### Top 1: Layered Architecture（4層）

**スコア**: 保守性4 / テスト容易性5 / スタック適合性5 / 学習コスト4 / シンプルさ4 = **22点**

#### ディレクトリ構成

```
src/
├── cli.ts                 # commander セットアップ・エントリーポイント
├── commands/
│   ├── validate.ts        # validate コマンドハンドラー（薄いルーティング）
│   └── generate.ts        # generate コマンドハンドラー（薄いルーティング）
├── core/
│   ├── schema.ts          # Zod スキーマ定義 + 型エクスポート
│   ├── parser.ts          # YAML → 型付きオブジェクト変換
│   ├── validator.ts       # 参照整合性チェック（クロスファイル）
│   └── generator.ts       # Playwright テストスケルトン生成
└── utils/
    └── output.ts          # picocolors / cli-table3 出力ユーティリティ
```

**ファイル数**: 9ファイル（シンプルかつ責務が明確）

#### 依存方向

```
cli.ts
  └── commands/validate.ts, commands/generate.ts
        └── core/parser.ts, core/validator.ts, core/generator.ts
              └── core/schema.ts（型定義）
utils/output.ts（commands/ と cli.ts から利用）
```

#### メリット

- **テスト容易性が最高**: core/ は純粋な TypeScript 関数の集合。引数を渡してテストするだけ。process.exit() / fs / stdout への依存なし
- **v2 コマンド追加が容易**: `commands/status.ts` を追加し、`cli.ts` に1行追加するだけ。既存コードへの影響ゼロ
- **Platform Expert の推奨**: CLI ツールの事実上の標準構成。コントリビューターが初見でも構造を理解できる
- **commander との相性**: コマンドハンドラー = `commands/*.ts`、ビジネスロジック = `core/*.ts` の対応が自明

#### デメリット

- **commands/ の薄さ**: v1 では commands/*.ts が「core/ を呼んで結果を出力するだけ」の薄いファイルになる。「この層は必要か？」と問われる場合がある
- **案 2 との差が微妙**: commands/ の有無だけの違い。初期は案 2 から始めて、コマンドが増えたら案 3 へ移行する判断でも良い

#### Devil's Advocate への回答

「3層で十分」という主張は正しい面がある。ただし commands/ があることで：
1. cli.ts が commander の設定に専念できる
2. 各コマンドの options 処理・引数検証が分離できる
3. コマンド単体のテストが commander セットアップなしで書ける

この 3 点が v1 でも有効に機能するため、4層を推奨する。

---

### Top 2: 3層構造（CLI / Core / Utils）

**スコア**: 保守性3 / テスト容易性4 / スタック適合性5 / 学習コスト5 / シンプルさ5 = **22点**

#### ディレクトリ構成

```
src/
├── cli.ts              # commander セットアップ + コマンドハンドラー
├── core/
│   ├── schema.ts       # Zod スキーマ + 型定義
│   ├── parser.ts       # YAML → 型付きオブジェクト
│   ├── validator.ts    # 参照整合性チェック
│   └── generator.ts   # テストスケルトン生成
└── utils/
    └── output.ts       # 出力ユーティリティ
```

**ファイル数**: 7ファイル（最小クラス）

#### メリット

- **最もシンプル**: OSS のファーストインプレッションが良い。「これなら読める」という印象
- **学習コストゼロ**: cli.ts・core/・utils/ の 3 分類は説明不要
- **Devil's Advocate の懸念を完全解消**: 「3層で十分」に正面から応える

#### デメリット

- **cli.ts が肥大化リスク**: v2 でコマンドが増えるにつれ、cli.ts の commander 設定が長くなる
- **コマンドハンドラーのテスト**: cli.ts 内のハンドラーを個別にテストしにくい。commander とハンドラーが密結合になる
- **責務の混在**: options 解析・引数バリデーション・core/ 呼び出し・出力が cli.ts に混在

#### 適用推奨状況

v1 の「validate + generate のみ」という最小構成で素早く公開したい場合。コマンドが 3 つ以上になる前に案 3 へのリファクタリングを計画する。

---

### Top 3: Feature Module

**スコア**: 保守性4 / テスト容易性4 / スタック適合性4 / 学習コスト3 / シンプルさ3 = **18点**

#### ディレクトリ構成

```
src/
├── cli.ts
├── validate/
│   ├── index.ts        # validate コマンドの公開 API
│   ├── parser.ts       # YAML 読み込み（validate 専用）
│   ├── validator.ts    # 参照整合性チェック
│   └── reporter.ts     # エラー出力
├── generate/
│   ├── index.ts        # generate コマンドの公開 API
│   ├── parser.ts       # YAML 読み込み（generate 専用）
│   └── generator.ts    # スケルトン生成
└── shared/
    ├── schema.ts        # 共通 Zod スキーマ
    └── output.ts        # 共通出力ユーティリティ
```

**ファイル数**: 10-11ファイル

#### メリット

- **コマンド間の完全独立**: validate を修正しても generate に影響しない
- **v2 拡張が理想的**: `status/` ディレクトリを追加するだけ。既存への影響ゼロ
- **テストの独立性**: 各機能のテストが完全に独立

#### デメリット

- **v1 では parser.ts が重複**: validate/parser.ts と generate/parser.ts が同じ YAML 読み込みロジックを持つ可能性が高い
- **shared/ の肥大化**: 「どこに置くか」判断が必要になり、コントリビューターが迷う
- **v1 の規模には早い**: 2コマンドのみの段階でコマンド別ディレクトリは過剰感がある

#### 適用推奨状況

v2 で status / sync / diagram コマンドを追加することが確実な場合。v1 の段階から命名规则を確立しておきたい場合。

---

## 総合判断

| 順位 | パターン | 合計 | v1 適合度 | v2 への道 |
|:---:|---------|:---:|:---:|:---:|
| 1位 | **Layered（4層）** | 22 | 最適 | コマンド追加が容易 |
| 2位 | **3層構造** | 22 | 最小構成 | cli.ts リファクタ必要 |
| 3位 | **Feature Module** | 18 | やや過剰 | コマンド追加が最も容易 |

**architecture-lead 推奨**: 案 3（Layered 4層）を第一推奨とする。
ただし「とにかく早くリリースしたい」場合は案 2（3層）でスタートし、v2 時点で案 3 へ移行するパスも合理的。

---

## ユーザーへの提示用サマリー

### 選択肢 A: Layered（4層）【推奨】

```
src/cli.ts → commands/{validate,generate}.ts → core/{schema,parser,validator,generator}.ts + utils/output.ts
```

- テストが最も書きやすい（core/ が純粋な関数）
- v2 コマンド追加は新ファイル追加のみ
- Platform Expert / OSS 標準の構成

### 選択肢 B: 3層（CLI/Core/Utils）【最小構成】

```
src/cli.ts → core/{schema,parser,validator,generator}.ts + utils/output.ts
```

- ファイル数が最小（7ファイル）
- 最もシンプルで説明不要
- v2 でコマンドが増えたら commands/ を切り出す

### 選択肢 C: Feature Module【v2 先取り】

```
src/cli.ts → validate/{index,parser,validator}.ts + generate/{index,parser,generator}.ts + shared/
```

- コマンド間が完全独立
- v2 での拡張が最も容易
- v1 では parser の重複リスクあり

---

*作成: architecture-lead / 2026-03-24*
