# 依存関係分析レポート (dependency-analyst)

## 1. 現状の依存グラフ（実測）

```
[外部]
  zod ←── schema.ts
  @oclif/core ←── cli.ts, commands/validate.ts, commands/generate.ts
  yaml ←── parser.ts
  picocolors ←── utils/output.ts
  node:fs/promises ←── parser.ts, commands/generate.ts
  node:path ←── parser.ts, commands/validate.ts, commands/generate.ts

[内部 - 依存方向]
  schema.ts ← parser.ts          (型 + スキーマ両方)
  schema.ts ← generator.ts       (型のみ: Case, Screen, Setup)
  schema.ts ← validator.ts       (型のみ: Screen, Setup)

  parser.ts ← commands/validate.ts
  parser.ts ← commands/generate.ts

  validator.ts ← commands/validate.ts
  validator.ts ← commands/generate.ts

  generator.ts ← commands/generate.ts

  utils/output.ts ← commands/validate.ts
  utils/output.ts ← commands/generate.ts

  cli.ts ← @oclif/core (エントリポイント、他の内部モジュールを直接 import しない)
```

### レイヤー構造

```
Layer 0: 外部 (zod, @oclif/core, yaml, picocolors, node:*)
Layer 1: core/schema.ts          ← 全コアの基盤
Layer 2: core/parser.ts          ← schema に依存
          core/generator.ts       ← schema (型のみ)
          core/validator.ts       ← schema (型のみ)
          utils/output.ts         ← 外部のみ (独立)
Layer 3: commands/validate.ts    ← parser, validator, output
          commands/generate.ts    ← parser, validator, generator, output
Layer 4: cli.ts                  ← @oclif/core (コマンドを自動検出)
```

## 2. schema.ts の現状分析

**現在の公開物:**
- `CaseSchema`, `ScreenSchema`, `SetupSchema`, `ConfigSchema` (Zodスキーマ)
- `Case`, `Screen`, `Setup`, `Config` (型)

**依存パターンの違い:**
- `parser.ts` → **スキーマ + 型** 両方を使用 (YAML バリデーションに Zod スキーマが必要)
- `generator.ts` → **型のみ** (スキーマ不要)
- `validator.ts` → **型のみ** (スキーマ不要)

**スキーマ負荷評価:** schema.ts が単一ファイルとして全コアの型定義 + Zod スキーマを持つ構造は現状シンプルで適切。新モジュール追加時も型追加程度で済む可能性が高く、スキーマ自体が膨張しない限り問題なし。

## 3. 新モジュール追加時の依存設計提案

### 追加予定モジュールと依存方向

#### A. `core/skill-generator.ts` (Skill 生成)
```
core/skill-generator.ts
  ← core/schema.ts     (型のみ: Screen, Setup, Config, Case)
  ← core/generator.ts  (必要なら再利用、なければ不要)
```
**判定: 適切。**
- schema.ts から型のみを import する既存パターンを踏襲
- generator.ts への依存は「テストファイル生成」ロジックを再利用する場合のみ。Skill 生成は別ドメインのため、基本的に schema.ts 型のみで十分
- generator.ts への依存が増えても一方向なので循環なし

#### B. `commands/add-skill.ts` (Skill 配布コマンド)
```
commands/add-skill.ts
  ← @oclif/core          (CLI フレームワーク)
  ← core/skill-generator.ts (Skill 生成)
  ← utils/output.ts     (表示)
  ← node:fs/promises    (ファイルコピー)
```
**判定: 適切。**
- commands 層が core 層に依存するパターンを踏襲
- parser/validator への依存不要（add-skill は YAML 解析不要）

#### C. `scripts/validate.ts` (バリデーションスクリプト)
```
scripts/validate.ts
  ← core/parser.ts
  ← core/validator.ts
  ← utils/output.ts
```
**判定: 適切。**
- commands/validate.ts とほぼ同構造だが、@oclif/core 非依存にできる
- ただし commands/validate.ts の処理と重複するリスクあり → 共通化を検討すべき

#### D. `scripts/auto-update.ts` (自動更新スクリプト)
```
scripts/auto-update.ts
  ← core/parser.ts
  ← core/generator.ts
  ← core/skill-generator.ts
  ← utils/output.ts
  ← node:fs/promises, node:path
```
**判定: 適切。**
- commands 層を経由せず core 直接利用で OK
- CLI フレームワーク非依存で軽量

## 4. 循環依存リスク

### リスクなし（現状 + 提案設計）
- schema.ts は何にも依存しない（zod 外部のみ）→ 循環の起点になれない
- generator.ts, validator.ts は型のみ import → スキーマ側に何も返さない
- skill-generator.ts が schema.ts + generator.ts を使う設計でも一方向

### 潜在リスク（要注意）

| シナリオ | リスク |
|---------|--------|
| skill-generator.ts が commands/* を import しようとする | 循環発生（commands → skill-generator → commands）|
| parser.ts が validator.ts を呼ぶ | 循環発生（validator ← commands/generate → parser） |
| utils/output.ts が core/* を import する | 循環発生（commands → output → core → commands）|

**設計ルール（維持すべき境界）:**
1. `schema.ts` は外部ライブラリ (zod) のみに依存 → 変更不可
2. `core/*` は `commands/*` を import してはいけない
3. `utils/*` は `core/*` を import してはいけない
4. `core/skill-generator.ts` は `core/generator.ts` か `core/schema.ts` のみ依存可

## 5. CLI コマンド層と core 層の境界維持

**現状の境界: 完全に維持されている**
- commands/* → core/* の一方向のみ
- core/* 間はフラットな依存（schema.ts を中心に、他は互いに依存しない）

**新モジュール追加後も境界維持できる条件:**
- `core/skill-generator.ts` を追加しても `commands/*` を import しない
- `commands/add-skill.ts` は必要な core モジュールのみを import
- scripts/* は commands/* を import しない（直接 core/* を使う）

## 6. まとめ

### 依存図（新モジュール含む）

```
zod
 └─ schema.ts
      ├─ parser.ts ──────────── commands/validate.ts ─┐
      ├─ generator.ts ────────── commands/generate.ts  │── cli.ts
      ├─ validator.ts ────────┘                        │
      └─ skill-generator.ts ─── commands/add-skill.ts ─┘

utils/output.ts ←── (all commands)
scripts/* ←── core/* 直接（commands 経由しない）
```

### 設計評価
- schema.ts が単一責任の型定義ハブとして機能しており、新モジュールを追加しても**構造は壊れない**
- core 層内の相互依存はなく、commands 層への逆流もない
- skill-generator.ts は generator.ts と同レイヤーに置くことで**自然な拡張**になる
- 循環依存リスクは設計ルールを守れば発生しない

### 注意点
- `parser.ts` だけがスキーマ（Zod オブジェクト）と型の両方を使う → 将来 schema.ts を分割（型のみの `types.ts` + スキーマの `schema.ts`）する選択肢はあるが、**現状のサイズでは過剰設計**
- `scripts/validate.ts` と `commands/validate.ts` で処理重複が生じる場合、共通ロジックを `core/validate-runner.ts` 等に抽出することを推奨
