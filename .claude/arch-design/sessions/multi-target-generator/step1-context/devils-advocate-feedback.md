# Devil's Advocate フィードバック: 過剰設計リスク評価

## 既存コードの評価

### generator.ts の現状
- **112行** のシンプルな純粋関数群
- 外部依存なし。`Schema` 型だけを受け取って `string` を返す
- `generateTestFile(screen, setups): string` という1つのエントリーポイント
- Playwright 固有の文字列 (`import { test, expect } from "@playwright/test"`) が **2箇所だけ** にハードコード

### generate.ts の現状
- **111行**。フラグ解析・バリデーション・ファイル書き込みのみ
- `generateTestFile` を1箇所で呼ぶだけ
- フレームワーク選択の概念はゼロ

---

## 評価の前提変更（architecture-lead の分析を受けて）

当初フィードバックでは「差分は2箇所」と評価したが、
**XCUITest (Swift) 対応**という具体的なターゲットが明示されたことで評価を修正する。

### Playwright vs XCUITest の差分

| 要素 | Playwright (TS) | XCUITest (Swift) |
|------|----------------|-----------------|
| import 文 | `import { test, expect } from "@playwright/test"` | `import XCTest` |
| テスト構造 | `test.describe(...)` / `test(...)` | `class XxxTests: XCTestCase` / `func testXxx()` |
| ファイル拡張子 | `.spec.ts` | `.swift` |
| async/await | `async () => {}` | `func testXxx()` (同期) |
| 言語 | TypeScript | Swift |

**これは「2箇所の差分」ではない。出力言語が変わる別物の生成器**。

単純な `if (framework === 'xcuitest')` 分岐で吸収するには、
生成ロジック全体が分岐だらけになる。この場合は **ファイル分割が正当化される**。

---

## 改訂評価: 何が過剰で、何が適切か

### 適切な設計（支持する）

1. **フレームワーク別ファイル分割**
   - `src/core/generators/playwright.ts`
   - `src/core/generators/xcuitest.ts`
   - 各 generator は `(Screen, Setup[]) => string` の純粋関数
   - **理由**: 出力言語が根本的に異なる。1ファイルに混在させるべきでない

2. **共通ロジックの `generator-helpers.ts` への抽出**
   - `buildTestName` / `buildComments` / `indentOf` は両 generator で共通
   - **理由**: これらは入力データの整形であり、出力言語に依存しない

3. **`FrameworkGenerator` 型の定義**（インターフェースではなく型で十分）
   ```ts
   type FrameworkGenerator = {
     generate: (screen: Screen, setups: Setup[]) => string;
     fileExtension: string;
   };
   ```
   - **理由**: `generate.ts` が各 generator を統一的に扱うために必要な最小限の契約

4. **静的 Registry (Record)**
   ```ts
   const generators: Record<string, FrameworkGenerator> = {
     playwright: playwrightGenerator,
     xcuitest: xcuitestGenerator,
   };
   ```
   - **理由**: 条件分岐より追加コストが低く、型安全

### 過剰な設計（引き続き反対する）

1. **Dynamic import / plugin 発見機構**
   - 対応フレームワークは事前に既知。外部プラグイン配布の需要はない
   - Static import で十分

2. **class-based の Generator 実装**
   - `implements FrameworkGenerator` のクラス構文は不要
   - オブジェクトリテラル `{ generate, fileExtension }` で十分

3. **Factory パターン**
   - `createGenerator(framework)` のような factory 関数は `Record` の lookup で代替できる
   - 追加の抽象化レイヤーは不要

4. **後方互換 re-export の温存**
   - `generator.ts` から `generateTestFile` を re-export し続けることは技術的負債を増やす
   - generate コマンドは registry 経由に一本化すべき
   - 外部 API（npm パッケージ）として公開しているなら別だが、CLI ツールなら不要

---

## 推奨する最終構造

```
src/core/
  generator-helpers.ts     ← buildTestName, buildComments, indentOf, quote
  generator-registry.ts    ← Record<string, FrameworkGenerator> + lookup
  generators/
    playwright.ts           ← Playwright 専用 generate 関数
    xcuitest.ts             ← XCUITest 専用 generate 関数
```

**削除するもの**:
- `src/core/generator.ts`（内容を上記に移植後）

**変更しないもの**:
- `src/core/schema.ts` / `parser.ts` / `validator.ts`
- `src/commands/generate.ts` への変更は `--framework` フラグ追加と registry lookup のみ

---

## 結論

当初フィードバックの修正: **XCUITest 対応が明示された時点で、ファイル分割と型定義は正当化される。**

ただし以下の問いは architecture-lead と module-designer に引き続き投げる:

1. **後方互換 re-export は本当に必要か？** generate コマンド内の直接呼び出しを registry 経由に変えれば、外部から `generateTestFile` を直接インポートする理由はないはず
2. **`generator-helpers.ts` に切り出す関数の範囲**: `renderNestedGroup` / `renderCaseGroup` / `renderCase` は Playwright 固有の構造に依存しているか？ XCUITest でも同じ分類構造（normal/error/boundary）を使うなら共通化できるが、Swift の class/func 構造は根本的に違う
