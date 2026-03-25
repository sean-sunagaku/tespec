# Step 2: generator 拡張パターン比較・選定

作成日: 2026-03-25

---

## 重要な前提情報（devils-advocate 発見）

`src/core/generator-swift.ts` が **完全実装済みで `generate.ts` から未接続な状態** で存在する。

```ts
// generator-swift.ts（実装済み）
export function generateSwiftTestFile(screen: Screen, setups: Setup[]): string { ... }
```

これによりタスクの性質が変わる:
- ✗ 「XCUITest generator を新規実装する」タスクではない
- ✓ 「既存の `generator-swift.ts` を registry 経由で `generate.ts` に接続する」タスク

**実装規模の見直し**: 最小コストで解決できる。

---

## 10案比較表

| ID | パターン名 | 概要 | スタック適合性 | シンプルさ (5=最高) | 拡張性 | 過剰設計リスク |
|----|----------|------|-------------|-------------------|--------|-------------|
| **P01** | 内部分岐（if/switch） | `generator.ts` に `framework` パラメータ追加、各 render 関数内で分岐 | 高 | 5 | 低（関数全体に散在） | 低（今は）/ 高（3案目以降） |
| **P02** | 静的 Record Registry | `Record<FrameworkId, FrameworkGenerator>` + `generator-types.ts` 分離 | 高 | 4 | 高 | 低 |
| **P03** | Strategy（クラス継承） | `abstract class FrameworkGenerator` をサブクラスが extends | 高 | 3 | 高 | 中（クラス設計が過剰） |
| **P04** | Template Method | `BaseGenerator` に `generate()` 骨格、`renderHeader/Case/Group` をオーバーライド | 高 | 2 | 高 | 中（継承ヒエラルキーが増える） |
| **P05** | 関数オブジェクト Registry（軽量変形） | P02 と同じ Registry 構造、interface なし、関数型のみで管理 | 高 | 4 | 中（型安全性が低い） | 低 |
| **P06** | Builder パターン | `TestFileBuilder` がメソッドチェーンで framework・screen を受け取り `build()` | 高 | 2 | 中 | 高（現状の要件に対して過剰） |
| **P07** | Pipes & Filters | `[classifyFilter] → [nameFilter] → [renderFilter]` の関数パイプライン | 高 | 2 | 中 | 高（関数合成の複雑さが増す） |
| **P08** | Plugin / dynamic import | `await import('./generators/${framework}.js')` で遅延ロード | 低 | 2 | 高 | 高（tsup バンドル + ESM 制約に注意） |
| **P09** | テンプレートエンジン（Handlebars/EJS） | `.hbs`/`.ejs` テンプレートファイルでフレームワーク差異を吸収 | 低 | 1 | 高 | 高（外部依存追加 + テンプレートデバッグが辛い） |
| **P10** | AST / CodeWriter | 意味 AST ノードを定義し、各 Printer が文字列変換 | 低 | 1 | 最高 | 非常に高（実装コストが桁違い） |

---

## 5軸スコアリング総合比較表

スコア基準: 1（最低）〜 5（最高）

| ID | 保守性 | テスト容易性 | スタック適合性 | 学習コスト低さ | シンプルさ | **合計** |
|----|--------|-------------|--------------|--------------|----------|---------|
| P01 | 2 | 3 | 5 | 5 | 5 | **20** |
| **P02** | **5** | **5** | **5** | **4** | **4** | **23** |
| P03 | 4 | 4 | 5 | 3 | 3 | **19** |
| P04 | 4 | 3 | 5 | 2 | 2 | **16** |
| P05 | 4 | 4 | 5 | 4 | 4 | **21** |
| P06 | 3 | 3 | 5 | 2 | 2 | **15** |
| P07 | 3 | 3 | 5 | 2 | 2 | **15** |
| P08 | 3 | 3 | 2 | 2 | 2 | **12** |
| P09 | 2 | 2 | 2 | 2 | 1 | **9** |
| P10 | 5 | 5 | 2 | 1 | 1 | **14** |

各軸の評価基準:
- **保守性**: 新フレームワーク追加時の変更箇所の少なさ・局所性
- **テスト容易性**: 各 generator を独立してユニットテストできるか
- **スタック適合性**: TypeScript ESM / tsup / oclif v4 との相性（platform-expert 評価）
- **学習コスト低さ**: コードを初めて読む人が理解できるまでの速さ
- **シンプルさ**: 実装量・抽象化の少なさ（devils-advocate 評価、P01 = 5 が基準）

### スコアリング詳細メモ

**保守性**:
- P01(2): 関数3〜4箇所に分岐が散在。3案目で崩壊
- P02(5): registry 1行追加で完結。generate.ts 変更不要
- P10(5): AST は最も保守性高いが実装コストが桁違い

**テスト容易性**:
- P01(3): 分岐ごとにテストケースが増え generator.test.ts が肥大化
- P02(5): 各 generator は純粋関数。独立テスト可能
- P08(3): dynamic import のテストは module mock が必要で煩雑

**スタック適合性**:
- P08(2): tsup バンドル後の dynamic import path 解決に未検証リスク
- P09(2): 外部依存追加 + dist へのテンプレートファイル同梱が必要
- P10(2): ts-morph でバンドルサイズ急増

**シンプルさ**（devils-advocate 評価）:
- P01(5): 新規ファイル不要。devils-advocate 案そのもの
- P02(4): 新規ファイル2つ（約35行）のみ
- P09(1)/P10(1): テンプレート/AST は根本的に別次元の複雑さ

---

## Top 3 絞り込み

### 第1位: P02 — 静的 Record Registry（推奨・採用）

**総合評価: 最高**

```
スタック適合性: 高
シンプルさ: 4/5
YAGNI準拠: ✓
拡張性: 高
実装コスト: 最小（registry.ts 約20行 + generate.ts 小変更）
```

`generator-swift.ts` が既存のため実装は「接続」のみ。
`Record<Target, ...>` の網羅性チェックにより、新 target 追加時の登録漏れをコンパイルエラーで検出できる。
generate コマンドはフレームワーク知識ゼロになり、OCP（開放閉鎖原則）に準拠。

**platform-expert・devils-advocate 両者が支持。**

---

### 第2位: P05 — 関数オブジェクト Registry（軽量変形、代替案）

**総合評価: 高（P02 より型安全性が低い分だけ劣る）**

```
スタック適合性: 高
シンプルさ: 4/5
YAGNI準拠: ✓
型安全性: P02 より低い（interface なし）
```

P02 と実装コストはほぼ同じ。
ただし `Record<FrameworkId, ...>` の網羅性チェックがなく、追加漏れをコンパイル時に検出できない。
P02 が採用できる状況であれば P05 を選ぶ理由はない。

---

### 第3位: P03 — Strategy パターン（クラスベース、将来の移行先候補）

**総合評価: 中（現時点では過剰だが将来の移行先として理解しておく価値あり）**

```
スタック適合性: 高
シンプルさ: 3/5
YAGNI準拠: △
拡張性: 高
```

フレームワーク数が5以上になり、各フレームワークが固有の設定・バリデーションを持つようになった場合の移行先。
現時点でクラス設計を導入するのは過剰だが、P02 との移行パスは直線的（interface → abstract class への昇格）。

---

## 脱落パターンの理由

| ID | 脱落理由 |
|----|---------|
| P01 | `generator.ts` の各 render 関数3〜4箇所に分岐が散在する。3案目で読解不能になる |
| P04 | Template Method の継承ヒエラルキーは2フレームワークには過剰 |
| P06 | Builder は出力オプションが大幅に増えてから検討 |
| P07 | Pipes & Filters は変換ステージが5以上になってから検討 |
| P08 | tsup バンドル後の dynamic import path 解決に未検証リスクあり |
| P09 | テンプレートファイルの dist 同梱・外部依存追加のコストが割に合わない |
| P10 | 実装コストが桁違い。このプロジェクトには明確に過剰 |

---

## 採用決定: P02（静的 Record Registry）

### 採用理由の要約

1. **実装コストが最小**: `generator-registry.ts` 約20行 + `generate.ts` の小変更のみ
2. **`generator-swift.ts` が既存**: 接続作業のみで XCUITest 対応が完了する
3. **型安全**: `Record<Target, ...>` の網羅性チェックで登録漏れをコンパイルエラー検出
4. **OCP 準拠**: 新フレームワーク追加時に `generate.ts` の変更が不要
5. **全チーム合意**: platform-expert・devils-advocate・dependency-analyst 全員が支持

### devils-advocate 追加提言（採用）

> helpers 抽出（`buildComments` / `renderCaseGroup` 重複の解消）は registry 接続とは独立した作業として別途判断を推奨。まず registry で繋ぐ → 動作確認 → 重複コード抽出は別 PR

**Step 3 以降の実装順序**:
1. `generator-registry.ts` 作成 + `generate.ts` 接続（最小変更）
2. 動作確認・テスト
3. `generator-helpers.ts` 抽出（重複コード解消）は別 PR

---

## 確定アーキテクチャ（Step 3 へのインプット）

```
src/core/
  generator-types.ts      ← FrameworkGenerator interface + Target type（新規・約15行）
  generator-registry.ts   ← Record<Target, FrameworkGenerator> + getGenerator()（新規・約20行）
  generator.ts            ← 後方互換 re-export のみに変更
  generator-swift.ts      ← 変更なし（既存・実装済み）
  generators/
    playwright.ts         ← generator.ts から実装を移動
    xcuitest.ts           ← generator-swift.ts から実装を移動（または re-export）

src/commands/
  generate.ts             ← --target フラグ追加 + registry 呼び出しに変更
```

**依存グラフ（一方向）**:
```
commands/generate.ts
  └── core/generator-registry.ts
        ├── core/generator-types.ts → core/schema.ts
        ├── core/generators/playwright.ts → core/generator-types.ts, core/schema.ts
        └── core/generators/xcuitest.ts  → core/generator-types.ts, core/schema.ts
```
