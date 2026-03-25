# Dependency Analyst: Step 2 結論フィードバック

## generator-swift.ts の実際の依存関係確認

既存の `generator-swift.ts` を読んだ結果:

```
generator-swift.ts (core/)
  └── ./schema.js  ← Case / Screen / Setup 型のみ import
```

`generator.ts` と全く同じ安定依存パターン。`schema.ts` のみへの依存で依存方向は完全にクリーン。

---

## 確定アーキテクチャの依存関係検証

Step 2 で確定した構造を依存関係の観点で検証する。

### 確定依存グラフ

```
commands/generate.ts
  └── core/generator-registry.ts
        ├── core/generator-types.ts → core/schema.ts
        ├── core/generators/playwright.ts → core/generator-types.ts, core/schema.ts
        └── core/generators/xcuitest.ts  → core/generator-types.ts, core/schema.ts

core/generator.ts (後方互換 re-export)
  └── core/generators/playwright.ts
```

**評価: 全依存が「不安定 → 安定」方向。循環依存なし。問題なし。**

---

## generator-swift.ts → generators/xcuitest.ts の移行に関する注意

`generator-swift.ts` が `generators/xcuitest.ts` に移動される際、`buildComments` が重複していることを把握済み。

依存関係上の注意点:

- `generator-swift.ts` の `buildComments` と `generator.ts` の `buildComments` は**完全に同一の実装**（ロジック・引数・戻り値が一致）
- devils-advocate の「helpers 抽出は別 PR」提言を支持するが、依存関係の観点から注意点を追加する

helpers 抽出を別 PR にした場合の過渡期の依存グラフ:

```
# PR1: registry 接続（helpers 抽出前）
generators/playwright.ts → schema.ts（buildComments を内包）
generators/xcuitest.ts   → schema.ts（buildComments を内包・重複）

# PR2: helpers 抽出後
generators/playwright.ts → generator-helpers.ts → schema.ts
generators/xcuitest.ts   → generator-helpers.ts → schema.ts
```

PR1 の段階で重複コードが存在するが、依存関係の方向性は正しい。依存グラフの健全性を保ったまま段階的に改善できる。

---

## Target 型の命名に関する確認

Step 2 成果物では `Target = 'playwright' | 'xctest'` と定義されているが、既存ファイル名は `generator-swift.ts` で関数名は `generateSwiftTestFile`。

**命名の整合性確認が必要**:
- `xctest` vs `xcuitest` vs `swift` — どれに統一するか
- `generate.ts` の `--target` フラグの値との一致
- `fileNameFor(screenId)` が返すファイル名との一致（`.swift` 拡張子）

依存関係そのものへの影響はないが、`generator-types.ts` に定義する `Target` 型の値が確定していることを Step 3 開始前に確認することを推奨。
