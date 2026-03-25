# 依存関係分析フィードバック

**担当**: dependency-analyst
**タスク**: #3
**日付**: 2026-03-24

---

## 1. データフローの全体像

```
YAML ファイル群
   │
   ▼
[FileLoader]          ← ファイルシステムアクセス層
   │  config.yaml / screens/*.yaml / setups/*.yaml を読み込む
   ▼
[YAMLParser]          ← 生 YAML → 未検証の中間オブジェクト
   │
   ▼
[TypedSchema]         ← 型定義・スキーマ定義（ScreenSpec / CaseSpec / SetupSpec）
   │  ※ これが安定の核
   ▼
   ├──→ [Validator]        ← 参照整合性チェック（given/navigates_to）
   ├──→ [Generator]        ← テストスケルトン生成
   ├──→ [DiagramBuilder]   ← PlantUML 生成
   └──→ [StatusManager]    ← .status.json の読み書き

[CLI Entry (commands/)]   ← 各コマンドが上記を組み合わせる
   validate → FileLoader → Parser → TypedSchema → Validator
   generate → FileLoader → Parser → TypedSchema → Generator
   diagram  → FileLoader → Parser → TypedSchema → DiagramBuilder
   status   → FileLoader → Parser → TypedSchema → StatusManager
   sync     → FileLoader → Parser → TypedSchema → StatusManager
```

---

## 2. 依存方向の候補と推奨

### 推奨する依存方向（単方向・外から内へ）

```
CLI Commands
    ↓
Use-case / Orchestrator（コマンドごとの処理フロー）
    ↓
Feature Modules（Validator / Generator / DiagramBuilder / StatusManager）
    ↓
Core（TypedSchema / Types）
    ↑
FileLoader / YAMLParser（→ Core の型に向けて変換する）
```

#### 原則
- **Core（型定義・スキーマ）は何にも依存しない**。他の全てが Core に依存する。
- **FileLoader / YAMLParser は Core の型を知っているが、Feature Modules は知らない**。
  - Parser は `unknown → TypedObject` の変換責務のみ持つ。
- **Feature Modules はお互いを直接参照しない**。
  - Validator が Generator を呼ぶ、または Generator が Validator を呼ぶ構造は禁止。
  - 必要な場合は Orchestrator 層で組み合わせる。
- **CLI Commands は Orchestrator を呼ぶだけ**。直接 Feature Module を呼ばない（呼ぶ場合も薄いラッパーに留める）。

---

## 3. 循環依存のリスク分析

### リスク 1: Validator ↔ Generator の相互依存（中リスク）

**シナリオ**: `tespec generate` 実行時に「バリデーション済みの YAML だけ生成する」仕様になると、Generator が Validator を呼びたくなる。さらに将来 Validator が「生成可能かチェック」するロジックを持つと循環する。

**対策**: Orchestrator 層で `validate → generate` の順序を制御する。Generator は「バリデーション済みオブジェクト」を受け取るだけとし、バリデーションロジックを自分で持たない。

### リスク 2: StatusManager ↔ Validator の結合（低〜中リスク）

**シナリオ**: `tespec sync` 時に「YAML に存在しないケースのステータスを削除する」処理が必要になると、StatusManager が Validator（または Parser 後のオブジェクト）を参照したくなる。

**対策**: StatusManager は型付きオブジェクト（TypedSchema）だけを受け取り、Validator モジュールには触れない。整合性判断は Orchestrator が行う。

### リスク 3: DiagramBuilder → Validator への依存（低リスク）

**シナリオ**: 遷移図生成時に `navigates_to` の参照先が実在するかチェックしたくなる。

**対策**: DiagramBuilder は「存在チェック済みのオブジェクト」を受け取る前提とする。チェック自体は Validator か Orchestrator に委ねる。`navigates_to` が存在しない screen を参照している場合は、図に `[?]` を付けるだけで十分（バリデーションエラーは Validator の責務）。

---

## 4. 安定度の評価

| モジュール | 安定度 | 理由 |
|---|---|---|
| `Core / TypedSchema` | **最高** | 全モジュールが依存する。変更すると全体に波及するため、慎重に固める必要がある |
| `YAMLParser` | **高** | YAML ライブラリへの依存のみ。スキーマ変更に追従する必要はあるが構造は単純 |
| `FileLoader` | **高** | ファイルシステム操作のみ。変更理由は Node.js の API 変更くらい |
| `Validator` | **中〜高** | バリデーションルールの追加・変更はあるが、Core の型に依存するだけなので閉じている |
| `StatusManager` | **中** | `.status.json` 構造の変更で影響を受ける。将来の拡張（priority など）が波及しやすい |
| `DiagramBuilder` | **中** | PlantUML フォーマット依存。将来的に Mermaid など別フォーマット対応が入ると変わる |
| `Generator` | **低〜中** | テストフレームワーク（Playwright / Vitest 等）への対応で変動しやすい |
| `CLI Commands` | **低** | UX 改善・オプション追加で頻繁に変わる。最も不安定 |

---

## 5. 設計への具体的推奨事項

### 5.1 Core の型を最初に固める

```typescript
// core/types.ts — 何にも import しない
export interface ScreenSpec { ... }
export interface CaseSpec { ... }
export interface SetupSpec { ... }
export interface ConfigSpec { ... }
export type ValidationResult = { ok: boolean; errors: string[]; warnings: string[] }
```

Core が不安定なままだと全モジュールがリファクタリングを強いられる。**Step 3 (モジュール設計) で最優先に決定すべき**。

### 5.2 Orchestrator 層を明示的に設ける

各 CLI コマンドに対応する Orchestrator 関数を `usecases/` または `commands/` に置く。

```
usecases/
  validateUsecase.ts   ← load → parse → validate → format output
  generateUsecase.ts   ← load → parse → validate → generate
  diagramUsecase.ts    ← load → parse → diagram
  statusUsecase.ts     ← load → parse → status display
  syncUsecase.ts       ← load → parse → sync
```

Feature Module 間の呼び出し順序はここだけが知っている。Feature Modules はお互いを知らない。

### 5.3 インターフェース境界の明確化

Parser の出力は「生オブジェクト」ではなく `ScreenSpec[]` 型に変換済みのものを返す。これにより Feature Modules は「YAML から来た」ことを知る必要がなくなり、将来 JSON や DB からデータが来ても対応できる。

---

## 6. まとめ

tespec の依存関係で最も重要なポイントは以下の3点:

1. **`Core/TypedSchema` を安定の核に置く**: 全モジュールがここだけに依存し、外向きの依存を持たない
2. **Feature Modules（Validator / Generator / DiagramBuilder / StatusManager）は横に依存しない**: 相互参照を禁止し、Orchestrator 経由でのみ組み合わせる
3. **循環依存の主要リスクは Validator ↔ Generator 間**: Orchestrator 層でシーケンスを制御することで回避できる

現在の仕様範囲（YAGNI 重視）では循環依存は発生しにくいが、future-plans.md の拡張（AI プロンプト生成・GitHub Actions 連携）が入ると StatusManager と Generator の責務が混濁しやすい。Orchestrator 層を最初から設けておくことでその際の影響を最小化できる。
