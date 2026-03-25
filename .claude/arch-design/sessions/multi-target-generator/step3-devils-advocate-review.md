# Step 3: Devils Advocate レビュー

作成日: 2026-03-25
レビュー対象: step3-module-design.md（フラット構成 + 静的 Record Registry）

---

## 総評: 合格

Step 3 の設計は YAGNI・KISS の観点から合格。以下に論点ごとの評価を示す。

---

## 1. フラット構成の採用: 支持

module-designer がフラット構成（案A）を採用した判断は正しい。

**根拠**:
- `generator.ts` / `generator-swift.ts` という既存ファイルが変更不要になる
- 変更ファイルが「新規2本 + 変更1本」に絞られる（最小変更原則）
- `generators/` サブディレクトリへの移動は既存コードのリネーム + import パス全更新を伴う。その作業コストに見合う利点が現時点では薄い

**将来への条件**: フレームワーク数が5本以上になった時点でサブディレクトリ化を検討する。それまではフラットで十分。

---

## 2. generator-registry.ts に toSwiftClassName を置く判断: 条件付き支持

`toSwiftClassName` を `generator-registry.ts` 内のプライベート関数として置く設計は、今回の scope では許容できる。

**懸念点**:
- `generator-swift.ts` にも同名関数が実装済みである（重複）
- PR2（helpers 抽出）時に重複解消の対象になるが、それまで2箇所に同一実装が存在する

**条件**: PR2 で `generator-swift.ts` の `toSwiftClassName` を `export` に変更して registry から参照する、または helpers に移す。二重定義を放置したまま PR3 以降に持ち越さないこと。

---

## 3. `isTarget()` 型ガードの必要性: 疑問あり（軽微）

`generate.ts` に `isTarget(rawTarget)` 型ガードを追加する設計は、oclif の `options:` バリデーションと二重チェックになる可能性がある。

**devils-advocate の主張**:
- oclif は `Flags.string({ options: AVAILABLE_TARGETS })` を指定した場合、有効でない値を渡されると CLI がエラーを出して早期終了する
- `isTarget()` が実際に `false` になるのはテスト環境や programmatic 呼び出しのみ
- `flags.target as Target` のキャストで十分（platform-expert も同意）

**結論**: `isTarget()` を追加することは型安全性として正しいが、必須ではない。実装者の判断に任せる。

---

## 4. 変更規模の妥当性: 支持

- 新規ファイル2本（約45行）+ 変更1本（+12行）= 合計約57行
- devils-advocate が主張した「最小コストで済む」という予測通りの規模

この規模は PR1 として一度にレビューできる適切な粒度。

---

## 5. 禁止 import ルールの明文化: 支持

dependency-analyst が追加した禁止ルール一覧（`schema.ts` / `parser.ts` / `validator.ts` 関連）は適切。特に:

- `parser.ts` / `validator.ts` がフレームワーク非依存であるべきというルールは重要
- `generator-types.ts → generator-registry.ts` の禁止は型定義モジュールの安定性を守る

CI での `madge` 導入推奨は採用する。ただし PR1 の scope ではなく別 issue として管理することを推奨。

---

## 6. スコープ外（別 PR）の明示: 強く支持

以下の判断を強く支持する:
- `buildComments` 等の重複解消は PR2 で実施
- `generator-helpers.ts` の新規作成は PR2

理由:
- PR1 と PR2 を混在させると diff が読みにくくなる（registry 接続 + リファクタリングが同時になる）
- 動作確認を PR1 完了時点でできる

**特に重要**: `generator-swift.ts` と `generator.ts` の `buildComments` は完全同一実装であることが確認されている。重複の存在は既知であり、PR1 では意図的に残している。コードレビュー時にこの判断を明示すること。

---

## 最終確認事項

PR1 の実装開始前に確認すべき点:

| 確認事項 | 状態 |
|---------|------|
| `Target = 'playwright' \| 'xctest'` の命名確定 | 確定済み（dependency-analyst 確認） |
| フラット構成の採用 | 確定済み（module-designer） |
| `--target` フラグ名（`--framework` でなく） | 確定済み（platform-expert 推奨） |
| `fileNameFor` を `FrameworkGenerator` interface に含める | 確定済み（module-designer） |
| `indentOf` を各 generator 独自で持つ | 確定済み（Playwright: 2スペース、XCUITest: 4スペース） |
| `buildComments` 重複解消は別 PR | 確定済み（devils-advocate 提言） |
