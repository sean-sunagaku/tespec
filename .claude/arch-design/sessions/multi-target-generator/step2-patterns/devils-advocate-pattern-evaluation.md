# Devils Advocate — Step 2 パターン評価

作成日: 2026-03-25
担当: devils-advocate（YAGNI / KISS / 過剰設計チェック）

---

## 前提: generator-swift.ts が既に存在する

`src/core/generator-swift.ts` を確認済み。
- `generateSwiftTestFile(screen, setups): string` が完全実装済み
- `generate.ts` から未接続なだけ

これはパターン選定に直接影響する。
**「XCUITest 対応を新規実装する」タスクではなく「既存ファイルを registry に繋ぐ」タスク。**

---

## platform-expert 提示の3パターン評価

### パターン A: 静的 Record Registry（推奨）

**YAGNI/KISS 観点: 合格**

```
実装コスト: generator-registry.ts 約20行 + generate.ts 小変更
新規ファイル: 1つ（generator-registry.ts）
既存ファイルの変更: generate.ts のみ
```

`generator-swift.ts` が既に存在するため、このパターンで必要な作業は:
1. `generator-registry.ts` を新規作成（約20行）
2. `generate.ts` に `--target` フラグを追加
3. `generate.ts` の `generateTestFile` 直接呼び出しを registry 経由に変更

これは最小コストで最大の拡張性を得られる。支持する。

**懸念点（軽微）:**
- `flags.target as Target` のキャストは小さな型安全性の穴だが、`Record<Target, ...>` の網羅性チェックが登録漏れを防ぐため許容範囲

---

### パターン B: oclif サブコマンド分割（反対）

**YAGNI/KISS 観点: 不合格**

```
実装コスト: 大（抽象基底クラス + コマンドファイル3つ + ディレクトリ構造変更）
後方互換性リスク: 高（既存 `tespec generate` の挙動変更の可能性）
```

**根拠:**
- `tespec generate:playwright` / `tespec generate:xctest` という CLI UX は現時点で要求されていない
- 既存ユーザーが `tespec generate` を使っている場合、サブコマンド化による破壊的変更が生じうる
- oclif v4 での `generate` と `generate:playwright` の共存挙動は検証コストが高い
- 抽象基底クラスは「継承によるコードシェア」であり、この規模では過剰

**適切なタイミング:** フレームワーク数が5以上、かつ各フレームワーク固有のフラグが必要になった時点。

---

### パターン C: GeneratorPlugin interface + factory（条件付き支持）

**YAGNI/KISS 観点: 条件付き合格**

パターン A と比較した唯一の利点は:
- `VALID_TARGETS` を動的生成するため、フラグの `options` が自動更新される
- `as Target` キャストが不要

しかし:
- `Record` の網羅性チェックがなくなる（追加漏れをコンパイルエラーで検出できない）
- パターン A より型安全性が低い

**判断:** パターン A で十分。パターン C の利点は現状の規模では価値が小さい。

---

## 追加候補: 最小限パターン（helpers 抽出なし）

既存の2ファイルに `buildComments` / `renderCaseGroup` / `indentOf` の重複があるが、
**helpers 抽出は Step 2 のスコープ外として判断を保留すべき。**

理由:
- registry を繋ぐだけなら重複があっても動く
- helpers 抽出は後のリファクタリングでも実施できる
- 同時に変更箇所を増やすとデグレリスクが上がる

**推奨:** まず registry で繋ぐ → 動作確認 → 重複コード抽出は別 PR

---

## スコアリング評価（5軸）

| 軸 | パターン A | パターン B | パターン C |
|----|----------|----------|----------|
| 実装コスト（低いほど良い） | 5 | 2 | 4 |
| 後方互換性 | 5 | 3 | 5 |
| 型安全性 | 4 | 4 | 3 |
| 拡張性（3フレームワーク以上） | 4 | 5 | 4 |
| YAGNI 準拠 | 5 | 2 | 4 |
| **合計** | **23** | **16** | **20** |

---

## 結論

**パターン A（静的 Record Registry）を推奨。**

`generator-swift.ts` が既に存在する事実を踏まえると、
実装は「20行の registry ファイル追加 + generate.ts の小変更」で完結する。

これ以上の抽象化（サブコマンド、factory、plugin）は現状では YAGNI 違反。

helpers 抽出（`buildComments` / `renderCaseGroup` 重複の解消）は
registry 接続とは独立した作業として別途判断を推奨。
