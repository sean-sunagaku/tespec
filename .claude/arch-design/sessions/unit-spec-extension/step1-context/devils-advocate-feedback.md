# Devil's Advocate Feedback: Unit Spec Extension

## 批判 1: スキーマ独立は YAGNI 違反

```
[問題の種類: YAGNI違反 / 過剰分割]

現在の設計が前提としていること: Screen と Unit は本質的に異なるため Zod スキーマを完全独立にする
この前提が崩れる状況: 実際の Case フィールドを比較すると action/expect/given/type/not_expect が全く同じ
より単純な代替設計: CaseSchema を共有し、Screen / Unit それぞれのトップレベルだけ別定義
  → CaseSchema は既に schema.ts:3-12 で定義済み。Unit 固有フィールドがない限り再利用で十分
リスク: スキーマ二重定義 → フィールド追加時に片方だけ更新し忘れる / 重大度: 重要
```

### 根拠

CaseSchema の7フィールド（action, expect, steps, given, target, type, not_expect）のうち、Unit Spec で不要になるのは `navigates_to` のみ（画面遷移は Unit に無関係）。残り6フィールドは意味的にも完全一致:

| フィールド | Screen での意味 | Unit での意味 | 差分 |
|---|---|---|---|
| action | ユーザー操作 | メソッド呼び出し/入力 | ラベルが違うだけ |
| expect | UI の期待状態 | 戻り値/状態の期待値 | ラベルが違うだけ |
| given | 前提条件 | 前提条件 | 同一 |
| type | normal/error/boundary | normal/error/boundary | 同一 |
| not_expect | 起きてはいけないこと | 起きてはいけないこと | 同一 |
| steps | 操作手順 | テスト手順 | 同一 |

**代替案**: `CaseSchema` を共有し、`navigates_to` を Screen 専用の optional として維持（現状のまま）。Unit のトップレベルスキーマだけ新規定義:

```typescript
// 追加するのはこれだけ
export const UnitMethodSchema = z.object({
  method: z.string(),
  cases: z.array(CaseSchema.omit({ navigates_to: true })),
});

export const UnitSchema = z.object({
  unit: z.string(),
  title: z.string(),
  methods: z.array(UnitMethodSchema),
});
```

これで CaseSchema の一元管理を維持しつつ、Unit 固有の構造を表現できる。

---

## 批判 2: 将来3種類を見据えた汎用化は過剰設計

```
[問題の種類: 過剰抽象化]

現在の設計が前提としていること: screen / unit / screen-transition の3種類が来るので汎用的な spec type 切り替え機構が必要
この前提が崩れる状況: 3種類目がいつ来るか不明。来たとしても構造が大きく異なる可能性が高い
より単純な代替設計: 今は screen + unit の2つだけをハードコードで対応
  → 3種類目が来た時点でリファクタすればよい（2→3は2倍の作業量ではない）
リスク: 汎用フレームワークの設計に時間を使い、実際の unit 機能の実装が遅れる / 重大度: 重要
```

### 根拠

- 現在の FrameworkGenerator インターフェースは `generate(screen: Screen, setups: Setup[])` と Screen に直結している。Unit 対応するには既にこのインターフェースを拡張する必要がある
- 「将来3種類」のために今から抽象化するより、Unit 追加時に必要最小限の拡張をし、3種類目が来たら共通パターンを抽出する方が正確な抽象化ができる
- Rule of Three: 抽象化は3つ目の事例が来てから行うのが定石

---

## 批判 3: vitest + XCTest の同時対応は本当に初日から必要か

```
[問題の種類: YAGNI違反]

現在の設計が前提としていること: Unit Spec は vitest と XCTest の両方を最初からサポート
この前提が崩れる状況: ユーザーが実際に両方使うケースは稀。片方で十分な初期フィードバックが得られる
より単純な代替設計: vitest のみで MVP → XCTest は Screen 側で実績があるので後追い容易
リスク: 低い。既存の xctest.ts ジェネレータのパターンがあるため後追い工数は小さい / 重大度: 軽微
```

### 根拠

- Screen の generate コマンドは既に `--target` フラグで playwright/xctest を切り替え可能。このパターンは Unit にもそのまま適用できる
- vitest 1ターゲットで Unit Spec の YAML 設計とパーサの品質を検証し、XCTest は第二フェーズで追加する方がフィードバックループが速い
- ただし、registry パターンは既に存在するため、vitest ジェネレータを registry に登録する形で実装すれば XCTest 追加は 1 ファイル追加で済む。これは許容範囲

**判定: 軽微。registry パターンを踏襲するなら同時対応のコストは低い。ただし YAML 設計に集中するため MVP では vitest のみを推奨**

---

## 批判 4: `--type` フラグは不要

```
[問題の種類: YAGNI違反]

現在の設計が前提としていること: `tespec generate --type unit` のようなフラグで spec 種別を絞り込む
この前提が崩れる状況: config.yaml に units_dir が定義されていなければ Unit Spec は存在しない
より単純な代替設計: units_dir の有無で自動判定。ディレクトリがなければスキップ
リスク: 不要なフラグが CLI の学習コストを増やす / 重大度: 軽微
```

### 根拠

- 既存の parser.ts は `screens_dir` / `setups_dir` を config から読んでいる。`units_dir` を追加し、存在しなければスキップするだけで十分
- ユーザーが「Screen だけ生成したい」場合は `units_dir` を config から外すか、ディレクトリを空にすればよい
- `--type` が必要になるのは「config に units_dir があるが一時的に Unit を除外したい」というニッチなケース。それは `--screen` フラグの既存パターンで個別指定できる

**代替案**: config.yaml に `units_dir` を optional で追加。存在すれば Unit を処理、なければスキップ。`--type` は不要。

---

## 批判 5: `methods:` ネスト構造の必要性

```
[問題の種類: 過剰抽象化 / 学習コスト]

現在の設計が前提としていること: Unit YAML は methods: でネストし、メソッドごとにケースをグルーピング
この前提が崩れる状況: Screen の cases: はフラットで十分機能している。ネストを導入する根拠は？
より単純な代替設計: フラット案（A案）
リスク: ネスト構造はスキーマ・パーサ・ジェネレータ全てに複雑さを加える / 重大度: 重要
```

### 根拠

フラット案:
```yaml
unit: UserService
title: "ユーザーサービス"
cases:
  - action: "createUser を空文字で呼ぶ"
    expect: "ValidationError が throw される"
    type: error
  - action: "getUser を有効な ID で呼ぶ"
    expect: "ユーザーオブジェクトが返る"
```

ネスト案:
```yaml
unit: UserService
title: "ユーザーサービス"
methods:
  - method: createUser
    cases:
      - action: "空文字で呼ぶ"
        expect: "ValidationError が throw される"
        type: error
  - method: getUser
    cases:
      - action: "有効な ID で呼ぶ"
        expect: "ユーザーオブジェクトが返る"
```

**フラット案の利点:**
1. Screen と全く同じ構造 → CaseSchema / parser / validator をそのまま再利用可能
2. ユーザーの学習コストゼロ（Screen を知っていれば Unit も書ける）
3. generator 側でメソッド名を `action` フィールドから抽出可能（例: `action: "createUser: 空文字で呼ぶ"`）

**ネスト案の利点:**
1. メソッド単位のグルーピングが明示的
2. 生成コードの describe/context ブロックがきれいになる

**判定**: ネスト案は見た目の整理には良いが、構造的な複雑さのコストが大きい。フラット案 + `target` フィールド（既に CaseSchema にある）をメソッド名として流用する方がシンプル。ただし、ユニットテストではメソッド単位のグルーピングに強い慣習があるため、**ネスト案にも一定の合理性はある**。

---

## 批判 6: ユーザーが2つの YAML フォーマットを学ぶ負担

```
[問題の種類: 学習コスト]

現在の設計が前提としていること: Screen と Unit は異なるドメインなので YAML も異なって当然
この前提が崩れる状況: 共通の Case 構造を持つなら、差分はトップレベルだけ。差分を最小化すべき
より単純な代替設計: トップレベルのみ差分（screen→unit, route→不要, cases→cases）、Case は完全共通
リスク: 独立スキーマだと微妙に異なるフィールド名が混在し混乱を招く / 重大度: 重要
```

### 根拠

ユーザーが覚えるべき差分を最小化するために:

| | Screen | Unit |
|---|---|---|
| トップレベルID | `screen: xxx` | `unit: xxx` |
| route | 必須 | 不要 |
| cases | `cases:` 直下 | `methods.[].cases` or `cases:` 直下 |
| Case フィールド | 共通 | 共通 |
| navigates_to | あり | なし |

Case が共通なら、ユーザーは「トップレベルが違うだけ」と理解できる。

---

## 総合判定

| 項目 | 推奨 | 重大度 |
|---|---|---|
| CaseSchema 共有 | 共有すべき。独立定義は YAGNI | 重要 |
| 汎用 spec type 機構 | 不要。ハードコード 2 種類で十分 | 重要 |
| vitest + XCTest 同時 | 許容。registry パターン踏襲なら低コスト | 軽微 |
| `--type` フラグ | 不要。config の units_dir 有無で自動判定 | 軽微 |
| methods ネスト | 要議論。フラット案でも機能するが、ネスト案にも合理性あり | 重要 |
| 学習コスト | Case 共通化で最小化すべき | 重要 |

### 最もシンプルな実装パス

1. `CaseSchema` を共有（`navigates_to` は Screen 専用 optional のまま）
2. `UnitSchema` を新規定義（`unit` + `title` + `methods` or `cases`）
3. `ConfigSchema` に `units_dir` を optional 追加
4. `parser.ts` の `parseYamlDirectory` をそのまま再利用（既に汎用的）
5. `vitest` ジェネレータを1つ追加、registry に登録
6. `generate` コマンドで units_dir があれば Unit も生成
7. `--type` フラグなし、`--target vitest` を Unit 用に追加
