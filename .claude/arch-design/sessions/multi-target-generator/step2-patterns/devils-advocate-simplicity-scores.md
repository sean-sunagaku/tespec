# Devils Advocate — シンプルさスコアリング（Step 2）

作成日: 2026-03-25

## 前提・スコア基準

| 点数 | 基準 |
|------|------|
| 5 | 新規ファイル0-1個、既存コードへの変更最小、抽象化レイヤーなし |
| 4 | 新規ファイル1-2個、小さな型定義あり、分岐が局所化 |
| 3 | 新規ファイル2-3個、インターフェース定義あり |
| 2 | 新規ファイル4個以上、またはクラス継承 / Factory パターン導入 |
| 1 | Dynamic import / DI コンテナ / plugin 発見機構 / テンプレートエンジン / AST |

**重要な前提:** `generator-swift.ts` は既に完全実装済み。「新規実装コスト」はゼロ。
評価は「既存コードに追加する変更量・抽象化量」のみを対象とする。

---

## スコアリング結果

### P01: 内部分岐（if/switch）
**シンプルさ: 4点**

- 新規ファイル: 0
- 変更: `generator.ts` に `framework` 引数追加 + 各 render 関数に分岐

Step 1 で分析した通り、XCUITest の差異は `renderNestedGroup` / `renderCase` / `indentOf` / `quote` の全関数に及ぶため、実態は40〜60行の分岐追加になる。3フレームワーク目で読解不能になるリスクあり。

**過剰設計リスク: 低**（今は単純だが、拡張時に技術的負債になる）

---

### P02: 静的 Record Registry（合意案ベース）
**シンプルさ: 4点**

- 新規ファイル: 2（`generator-types.ts` + `generator-registry.ts`）
- 変更: `generate.ts` に `--target` フラグ追加 + registry 経由に変更

`generator-swift.ts` が既存のため、registry に登録するだけ。
interface + Record の組み合わせは型安全で追加コストが低い。
P01 と同点だが、**3フレームワーク目以降のコスト増加がゼロ**という点で優れる。

**過剰設計リスク: 低**（Step 1 合意案。適切な抽象化量）

---

### P03: Strategy パターン（クラスベース）
**シンプルさ: 2点**

- 新規ファイル: 3-4（abstract class + 各実装クラス）
- abstract class の導入で `generator.ts` と `generator-swift.ts` を class に書き換え必要

既存の純粋関数を class に変換するリファクタリングコストが発生する。
P02 と同じ目的を class 継承で達成しようとしているが、関数型の実装に対して過剰。

**過剰設計リスク: 中**（GoF パターンの教科書的適用。この規模では不要）

---

### P04: Template Method パターン
**シンプルさ: 2点**

- 新規ファイル: 3-4（BaseGenerator + サブクラス2つ）
- `renderHeader()` / `renderCase()` / `renderGroup()` の3メソッドオーバーライドが必要

継承階層の導入でコード追跡が困難になる。
`super.generate()` → `this.renderHeader()` の制御フローは純粋関数より理解しにくい。
P03 より問題が多い（継承 + オーバーライドの複雑さ）。

**過剰設計リスク: 高**（継承による共通化は関数抽出で十分な問題を複雑にする）

---

### P05: 関数オブジェクト Registry（合意案の軽量変形）
**シンプルさ: 5点**

- 新規ファイル: 1（`generator-registry.ts`）
- interface を持たず `GeneratorFn` 型のみ

P02 よりさらに軽量。`generator-types.ts` が不要になる。
ただし `fileExtension` / `fileNameFor` を別 Map か generate.ts 側が持つことになり、
フレームワーク固有のファイル名規則（Swift の PascalCase + Tests サフィックス）が
generate.ts に漏れ出すリスクがある。

**過剰設計リスク: 低**（最小構成。ただし fileNameFor の扱いで generate.ts が汚れる可能性）

---

### P06: Builder パターン
**シンプルさ: 1点**

- 新規ファイル: 2-3（TestFileBuilder クラス + メソッドチェーン API）
- 既存の `generateTestFile(screen, setups)` という明快な API を Builder に置き換える

メソッドチェーンは「オプションが多い構築処理」に向いているが、
tespec の generate は引数が `screen` と `setups` の2つだけ。
問題の複雑さに対して API が過剰。

**過剰設計リスク: 高**（Builder はオプション数が多い場合に価値を発揮する。ここでは不要）

---

### P07: Pipes & Filters（変換パイプライン）
**シンプルさ: 2点**

- 新規ファイル: 3-5（各 filter 関数 + パイプライン組み立て）
- フィルター配列の設計・型定義・composing が必要

`[classifyFilter] → [nameFilter] → [commentFilter] → [renderFilter]` の分解は
現状の generator.ts の関数分割（`buildTestName` / `buildComments` / `renderCase`）と
実質同じだが、パイプライン構造として再設計するコストが発生する。
関数型プログラミングの美しさはあるが、この問題に対して過剰。

**過剰設計リスク: 中**（アーキテクチャが変わるほどのメリットがない）

---

### P08: Plugin / dynamic import（遅延ロード）
**シンプルさ: 1点**

- 新規ファイル: 多数（plugin インターフェース + 動的ロード機構）
- `await import()` による非同期ロード、エラーハンドリング、型安全性の喪失

対応フレームワークは事前に既知（playwright / xcuitest のみ）。
サードパーティが generator plugin を配布する需要はない。
dynamic import が解決する問題が存在しない。

**過剰設計リスク: 最高**（解決すべき問題が存在しない機構を実装する典型的な過剰設計）

---

### P09: テンプレートエンジン（Handlebars / EJS）
**シンプルさ: 1点**

- 外部依存: Handlebars または EJS の追加
- 新規ファイル: テンプレートファイル群 + ローダー

TypeScript で直接文字列を生成するコードを、
テンプレートファイルに置き換える理由がない。
外部依存の追加、テンプレートファイルの管理、ビルド時の扱いなど
コストが増加する一方でメリットがほぼない。

**過剰設計リスク: 最高**（外部依存を追加してまで得るものがない）

---

### P10: AST / CodeWriter ベース
**シンプルさ: 1点**

- 外部依存: `ts-morph` または独自 AST 実装
- 新規ファイル: AST ノード定義 + 各 Printer

複数言語（TypeScript / Swift）への出力を「意味表現から変換」するアプローチは
本来はコードジェネレーターツールキットやコンパイラの領域。
tespec の出力は「コメント付きのスタブコード」であり、
AST が必要なほど構造的な変換ではない。

**過剰設計リスク: 最高**（問題の規模に対して数倍のエンジニアリングコスト）

---

## スコアまとめ

| ID | パターン | シンプルさ | 過剰設計リスク |
|----|---------|----------|--------------|
| P05 | 関数オブジェクト Registry | **5** | 低 |
| P01 | 内部分岐（if/switch） | **4** | 低〜中 |
| P02 | 静的 Record Registry（合意案） | **4** | 低 |
| P03 | Strategy パターン（クラスベース） | **2** | 中 |
| P04 | Template Method パターン | **2** | 高 |
| P07 | Pipes & Filters | **2** | 中 |
| P06 | Builder パターン | **1** | 高 |
| P08 | Plugin / dynamic import | **1** | 最高 |
| P09 | テンプレートエンジン | **1** | 最高 |
| P10 | AST / CodeWriter | **1** | 最高 |

---

## devils-advocate 推奨

**P02（静的 Record Registry）を推奨。P05 も許容範囲。**

P05 は最もシンプルだが、`fileNameFor` の責務が generate.ts に漏れるリスクがある。
P02 は interface を持つことで各 generator が自分のファイル名規則を管理できる。
この差は XCUITest の `LoginScreenTests.swift` という PascalCase 変換を
generate.ts が知るべきかどうかという設計判断に直結する。

**P03〜P10 は全て現状の問題規模に対して過剰。採用しないことを強く推奨。**
