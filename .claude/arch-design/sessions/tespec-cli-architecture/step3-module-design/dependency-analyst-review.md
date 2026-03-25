# 依存方向レビュー

**担当**: dependency-analyst
**タスク**: Step 3 - 依存方向レビュー
**日付**: 2026-03-24
**レビュー対象**: module-designer-proposal.md（2026-03-24版）

---

## 0. レビュー対象モジュール構成

module-designer の提案：

```
src/
├── cli.ts
├── commands/
│   ├── validate.ts
│   └── generate.ts
├── core/
│   ├── schema.ts
│   ├── parser.ts
│   ├── validator.ts
│   └── generator.ts
└── utils/
    └── output.ts
```

提案に含まれる各モジュールの依存先（proposal から抽出）:

| モジュール | 依存先 |
|-----------|--------|
| `core/schema.ts` | `zod` のみ |
| `core/parser.ts` | `node:fs/promises`, `node:path`, `yaml`, `./schema` |
| `core/validator.ts` | `./schema`（型定義のみ） |
| `core/generator.ts` | `./schema`（型定義のみ） |
| `utils/output.ts` | `picocolors` のみ |
| `commands/validate.ts` | `../core/parser`, `../core/validator`, `../utils/output`, `node:process` |
| `commands/generate.ts` | `../core/parser`, `../core/validator`, `../core/generator`, `../utils/output`, `node:fs/promises`, `node:path`, `node:process` |
| `cli.ts` | `commander`, `./commands/validate`, `./commands/generate` |

---

## 1. 各モジュールの安定度評価

| モジュール | 安定度 | 変更理由 | 被依存数 |
|-----------|--------|----------|---------|
| `core/schema.ts` | **最高** | YAML 仕様変更時のみ | 全内部モジュール（4） |
| `core/parser.ts` | **高** | YAML ライブラリ差し替え / ファイル探索ロジック変更 | commands/（2） |
| `core/validator.ts` | **中〜高** | バリデーションルール追加・変更 | commands/（2） |
| `core/generator.ts` | **低〜中** | テストフレームワーク変更（Playwright → Vitest 等）| commands/generate のみ（1） |
| `utils/output.ts` | **中** | picocolors 差し替え / 出力フォーマット標準変更 | cli.ts, commands/（3） |
| `commands/validate.ts` | **低** | コマンド引数・オプション変更 / 出力調整 | cli.ts のみ（1） |
| `commands/generate.ts` | **低** | コマンド引数・オプション変更 / 書き込みパス規則変更 | cli.ts のみ（1） |
| `cli.ts` | **最低** | コマンド追加（v2） / グローバルオプション変更 | なし（エントリーポイント） |

**安定度の原則検証**: 安定度が高いモジュールほど多くのモジュールから依存される構造になっており、原則（安定依存の原則）に適合している。

---

## 2. 依存グラフ（proposal 確定版）

```
【凡例】
→  : 依存（import する）
   括弧内は依存の種類

cli.ts
  ├──→ commands/validate.ts
  └──→ commands/generate.ts
  ※ cli.ts は utils/output.ts を import しない（proposal 確認済み）

commands/validate.ts
  ├──→ core/parser.ts
  ├──→ core/validator.ts
  └──→ utils/output.ts

commands/generate.ts
  ├──→ core/parser.ts
  ├──→ core/validator.ts    ← validate を先行実行するため
  ├──→ core/generator.ts
  └──→ utils/output.ts

core/parser.ts
  └──→ core/schema.ts       ← Zod スキーマ + 型使用

core/validator.ts
  └──→ core/schema.ts       ← 型定義のみ（Screen, Setup）

core/generator.ts
  └──→ core/schema.ts       ← 型定義のみ（Screen, Setup, Case）

utils/output.ts
  └── picocolors のみ（内部依存なし）

core/schema.ts
  └── zod のみ（内部依存なし）
```

### 依存方向の階層図

```
 不安定（変更頻度高）                安定（変更頻度低）
 ─────────────────────────────────────────────────────→

 cli.ts
   │
   ├──→ commands/validate.ts ──→ core/parser.ts ──→ core/schema.ts
   │          │               ╲                       ↑
   │          └──→ utils/output│ core/validator.ts ──→┘
   │                           │                       ↑
   └──→ commands/generate.ts ──┤ core/generator.ts ───┘
               └──→ utils/output.ts
```

---

## 3. 依存方向の検証（外→内 = 不安定→安定）

| 依存関係 | 方向 | 判定 |
|---------|------|------|
| `cli.ts → commands/validate.ts` | 不安定 → より安定 | OK |
| `cli.ts → commands/generate.ts` | 不安定 → より安定 | OK |
| `commands/validate.ts → core/parser.ts` | 不安定 → 安定 | OK |
| `commands/validate.ts → core/validator.ts` | 不安定 → 安定 | OK |
| `commands/validate.ts → utils/output.ts` | 不安定 → 中 | OK |
| `commands/generate.ts → core/parser.ts` | 不安定 → 安定 | OK |
| `commands/generate.ts → core/validator.ts` | 不安定 → 安定 | OK |
| `commands/generate.ts → core/generator.ts` | 不安定 → 低〜中 | OK（同層内の安定方向） |
| `commands/generate.ts → utils/output.ts` | 不安定 → 中 | OK |
| `core/parser.ts → core/schema.ts` | 高 → 最高 | OK |
| `core/validator.ts → core/schema.ts` | 中〜高 → 最高 | OK |
| `core/generator.ts → core/schema.ts` | 低〜中 → 最高 | OK |

**結論**: 全ての依存が「外から内へ（不安定から安定へ）」向いており、依存方向の原則を満たしている。

---

## 4. 循環依存チェック

### チェック対象パス（全網羅）

**1. cli.ts 起点**
- `cli.ts → commands/validate.ts → core/parser.ts → core/schema.ts → （zod のみ）` — 終端
- `cli.ts → commands/validate.ts → core/validator.ts → core/schema.ts → （zod のみ）` — 終端
- `cli.ts → commands/validate.ts → utils/output.ts → （picocolors のみ）` — 終端
- `cli.ts → commands/generate.ts → core/generator.ts → core/schema.ts → （zod のみ）` — 終端
- いずれも cli.ts に戻るパスなし → **問題なし**

**2. Feature Module 間（最重要チェック）**
- `core/validator.ts → core/generator.ts`：proposal に依存なし → **問題なし**
- `core/generator.ts → core/validator.ts`：proposal に依存なし → **問題なし**
- `core/parser.ts → core/validator.ts`：proposal に依存なし → **問題なし**
- `core/parser.ts → core/generator.ts`：proposal に依存なし → **問題なし**

**3. utils/output.ts 起点**
- `utils/output.ts → （picocolors のみ）` — 終端
- core/ / commands/ への依存なし → **問題なし**

**4. core/schema.ts 起点**
- `core/schema.ts → （zod のみ）` — 終端
- 内部依存なし → **問題なし**

**循環依存: 発見されず**

---

## 5. import 許可/禁止ルールの検証（proposal 照合）

### 許可ルール

| from | to | proposal での実装 | 判定 |
|------|----|-----------------|------|
| `cli.ts` | `commands/*` | validate, generate を import | OK |
| `commands/*` | `core/*` | parser, validator, generator を import | OK |
| `commands/*` | `utils/output.ts` | output.ts を import | OK |
| `core/parser.ts` | `core/schema.ts` | schema.ts を import | OK |
| `core/validator.ts` | `core/schema.ts` | 型定義のみ import | OK |
| `core/generator.ts` | `core/schema.ts` | 型定義のみ import | OK |

### 禁止ルール（proposal で守られているか確認）

| from | to | proposal での記述 | 判定 |
|------|----|-----------------|------|
| `core/*` | `commands/*` | 依存なし（proposal に記述なし） | OK |
| `core/*` | `cli.ts` | 依存なし | OK |
| `core/validator.ts` | `core/generator.ts` | 依存なし | OK |
| `core/generator.ts` | `core/validator.ts` | 依存なし | OK |
| `core/*` | `utils/output.ts` | 明示的に禁止と記載 | OK |
| `utils/output.ts` | `core/*` | picocolors のみの依存であり侵害なし | OK |
| `utils/output.ts` | `commands/*` | 依存なし | OK |

---

## 6. 提案固有の設計判断に対する検証

### 6.1 utils/output.ts の関数シグネチャ（業務型を含まない）

proposal の `utils/output.ts` 関数シグネチャ：

```typescript
printError(file: string, message: string): void
printWarning(file: string, message: string): void
printOk(file: string): void
printSuccess(message: string): void
```

全て `string` のみを受け取る設計になっており、`Screen` / `Setup` 等の業務型を受け取らない。
これにより `utils/output.ts → core/schema.ts` の依存が発生しない。

**判定: OK**。懸念していたリスク C（utils への業務型混入）が設計段階で回避されている。

### 6.2 core/parser.ts の FS アクセス許容

proposal の説明：「ファイルシステムアクセスの責務が parser 以外にはなく、commands/ 層に置くと commands/* が肥大化するため」

この判断の依存方向への影響：
- `core/parser.ts` は `node:fs/promises` に依存する（副作用あり）
- ただし `node:fs` はプロジェクト内モジュールではなく Node.js 組み込みであり、循環依存のリスクはない
- `core/parser.ts → core/schema.ts` の依存方向は問題ない
- テストは fixture ディレクトリで副作用をコントロールする方針であり合理的

**判定: OK**。依存方向の観点では問題なし。

### 6.3 commands/generate.ts が fs.promises で直接書き込む件

proposal では `commands/generate.ts` が `node:fs/promises` を import してファイル書き込みを行う。

これを検証すると：
- ファイル「書き込み」を commands 層が担い、「読み込み」は parser が担う設計
- 読み書きの責務が分割されているが、proposal 内に明確な意図の記載あり（`--dry-run` 条件分岐が commands の責務と定義）
- `core/generator.ts` は文字列を返すだけで書き込みを知らない

**判定: OK**。`generator.ts` が純粋関数として保たれており、依存方向のルールを守っている。

### 6.4 commands/validate.ts の process.exit() 配置

proposal では `commands/validate.ts` が `node:process` を import して `process.exit()` を呼ぶ。

- `process.exit()` が `core/*` に存在しないことを確認（明示的に禁止と記載）
- `cli.ts` ではなく `commands/*.ts` で exit を呼ぶ設計
- 設計方針「process.exit() はトップレベルのみ」との照合：commands/ はトップレベル（エントリー側）に近い層であり許容範囲内

**判定: OK**。ただし補足注記を後述（セクション 7 参照）。

---

## 7. 補足・注意事項

### 注意事項 A: process.exit() の配置について

確定事項では「process.exit() はトップレベルのみ」とされているが、proposal では `commands/*.ts` に配置されている。これは矛盾しているように見えるが、実質的には問題ない。

理由：
- `cli.ts`（真のエントリーポイント）は commander のセットアップのみを担い、exit は持たない
- `commands/*.ts` は cli.ts から見た「コマンドハンドラー」であり、ユーザー向けの境界層
- `core/*` には exit が存在しない（純粋関数層が保たれている）

ただし、将来的に `commands/*.ts` が増えると「各コマンドが個別に exit コードを判断する」構造になる。これは一貫性に欠ける可能性があるため、v2 でコマンドが増えた際に exit コードの統一管理（例: `commands/base.ts` に共通 exit ロジック）を検討することを推奨する。

### 注意事項 B: core/schema.ts の一極集中

全 core モジュールが `schema.ts` に依存するため、型定義の変更は全体波及する。
これは設計上避けられない構造であり、問題ではなく「意図された安定依存」である。

対応：`schema.ts` の型インターフェースを実装開始前に確定させること（Step 3 完了時の必須アクション）。

---

## 8. 総合判断

**問題なし**

module-designer の提案は以下の全条件を満たしている：

1. 依存方向が「外→内（不安定→安定）」に統一されている
2. 循環依存が存在しない
3. Feature Modules（validator/generator）が互いに依存しない
4. core/ が副作用を持たない純粋関数層として機能する（parser の FS 読み込みは許容済み）
5. process.exit() が core/ に存在しない（commands/ 層に閉じている）
6. utils/output.ts の関数シグネチャが汎用型のみで、core/ 型の混入なし

提案をそのまま実装フェーズに進めて問題ない。

---

*作成: dependency-analyst / 2026-03-24*
*レビュー対象: module-designer-proposal.md（2026-03-24版）*
