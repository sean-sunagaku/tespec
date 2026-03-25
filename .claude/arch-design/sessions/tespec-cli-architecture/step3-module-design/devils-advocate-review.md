# Devils Advocate レビュー: YAGNI/KISS 批判

**作成日**: 2026-03-24
**対象**: module-designer-proposal.md
**観点**: v1（validate + generate の2コマンド）に対してモジュール分割が過剰でないか

---

## 総評

**結論: 提案はほぼ妥当。致命的な過剰設計はない。**
ただし、複数の「将来のため」が混入している。以下の指摘に対応すれば、よりシンプルなv1になる。

ファイル数: 8ファイル（cli.ts + 2 commands + 4 core + 1 utils）
v1の本質: YAML読んで検証して、テスト文字列を書き出す。それだけ。

---

## 致命的指摘（設計変更が必要）

### [致命1] `core/schema.ts` の独立ファイル化は不要

**問題**: Zodスキーマと型定義だけのファイルを独立させるのはYAGNI。
`core/parser.ts` の中で宣言・エクスポートして何も困らない。

**根拠**:
- v1でZodスキーマが「parser以外から独立して変更される」理由がない
- `validator.ts` と `generator.ts` が型だけを使うのは事実だが、`parser.ts` からインポートすれば済む
- ファイルを増やすことでOSSコントリビューターの「どこから読むか」問題が発生する

**代替案**:
```
// parser.ts の先頭でスキーマと型を定義・エクスポートする
export const CaseSchema = z.object({ ... });
export type Case = z.infer<typeof CaseSchema>;
// ...
export async function parseProject(...) { ... }
```

**もし残すなら**: `schema.ts` を残す正当化条件は「v1の時点で schema.ts だけを変更するケースが明確に存在する」こと。Zod仕様が変更されたとき parser.ts と schema.ts の両方を変更するなら、分離の意味がない。

---

### [致命2] `core/generator.ts` の非公開関数4本は過剰

**問題**: `buildNormalTest`, `buildTaggedTest`, `resolveGiven`, `normalizeExpect` の4つを内部関数として定義しているが、これは「将来のテスト可能性のための設計」であり、v1では不要な抽象化。

**根拠**:
- 公開インターフェースは `generateTestFile(screen, setups): string` の1関数だけ
- 内部実装として4つの関数に分割するのは適切だが、**設計時点でこの粒度まで宣言する必要はない**
- 実装時に自然に切り出せばいい。設計書に書くことで「変えてはいけない」という誤った圧力になる

**代替案**: 提案書の `core/generator.ts` の「非公開（内部実装）」セクションを削除。公開インターフェースの `generateTestFile` のシグネチャだけ合意する。

---

## 重要指摘（要検討）

### [重要1] `commands/generate.ts` の `--screen` オプションはv1に必要か？

**問題**: `--screen` オプション（特定画面のみ生成）はv1で必須か不明。

**根拠**:
- 設計書 `docs/tespec-design.md` の `tespec generate` コマンド定義には `[--screen <id>]` が記載されているので存在は正当
- しかし、最初は「全画面生成のみ」で十分なことが多い
- `--screen` があると `commands/generate.ts` の処理フロー4番（絞り込み）が増え、テストケースも増える

**判断**: 設計書にある以上 v1 スコープ内だが、もし「まず動くものを」なら外してもよい。module-designer に確認を求める。

---

### [重要2] `validate` コマンドの `WARNING` チェック項目が設計書と一致していない

**問題**: 設計書 (`docs/tespec-design.md`) の validate チェック一覧には以下がある:
- `type: error` のケースが0件 → warning
- `type: boundary` のケースが0件 → warning

しかし module-designer 提案の `core/validator.ts` には `checkEmptyCases`（casesが空）しかなく、上記2ルールが抜けている。

**影響**:
- `validator.ts` のインターフェースは変わらないが、実装で `checkErrorTypeMissing` / `checkBoundaryTypeMissing` が必要
- テスト方針の「ルールごとの独立検証」にこの2ルールが含まれていないと漏れる

**対応**: v1に含めるなら、`validator.ts` の内部実装定義に2関数追加が必要。

---

### [重要3] `utils/output.ts` の `printOk` はv1で必要か？

**問題**: `printOk(file)` は `validate` コマンドの「OK: login.yaml」出力に使われるが、これは単なる `console.log` のラッパー。

**根拠**:
- picocolors ラッパーとして4関数まとめることには意味がある（一貫した出力フォーマット）
- ただし、`printOk` だけは「色もなく単純」なケースが多い
- 一方で、`printError`/`printWarning`/`printSuccess` の3関数と組み合わせて使うため、独立して削れるわけでもない

**判断**: このままでよい。軽微な懸念に格下げ。

---

## 軽微な懸念

### [軽微1] `ParsedProject` インターフェースの `config` フィールドは commands/ で使われるか？

`validateCommand` の処理フローを見ると:
1. parse → errors チェック
2. `validate(screens, setups)` に `screens` と `setups` だけを渡す

`ParsedProject.config` は `commands/generate.ts` の書き込み先パス計算で使う可能性はあるが、明示されていない。インターフェースとして正当。指摘なし。

---

### [軽微2] `ParseError` と `ValidationIssue` の型が似すぎている

```typescript
// ParseError
{ file: string; message: string; }

// ValidationIssue
{ level: 'error'|'warning'; file: string; field: string; message: string; }
```

`commands/validate.ts` ではこの2種類を異なる処理パスで扱う必要があり（parseエラーは即exit、validationエラーは全件収集後exit）、型が別なのは正当。ただし、OSSコントリビューターが混乱する可能性あり。コメントで「parseエラーはZod構造エラー、ValidationIssueはクロスファイル整合性エラー」と明記を推奨。

---

### [軽微3] テスト戦略の `utils/output.ts` は「直接テスト不要」は正しいが...

commands/* の統合テストで「副次的にカバー」という方針は、カバレッジが不安定になる。もし将来 output.ts の挙動を変えた場合に検知できない。ただし v1 では許容範囲。

---

## 最もシンプルな代替案（極端なKISSバージョン）

もし「OSS公開前の最小実装」として組み立てるなら、以下の6ファイル構成も検討に値する:

```
src/
├── cli.ts           # commander セットアップ
├── parser.ts        # schema + parse（マージ）
├── validator.ts     # クロスファイルチェック
├── generator.ts     # テスト文字列生成
└── commands/
    ├── validate.ts  # オーケストレーション
    └── generate.ts  # オーケストレーション
```

変更点: `core/schema.ts` を `parser.ts` に統合、`utils/output.ts` を廃止して各コマンド内でpicocolorsを直接使用。

**この代替案を採用すべきか**: 否。`utils/output.ts` の分離は、出力フォーマット変更時の変更箇所を1ファイルに限定する理由があるため保持価値あり。`core/schema.ts` の統合（致命1）のみ採用を推奨。

---

## 指摘サマリー

| 優先度 | 指摘 | 推奨アクション |
|--------|------|---------------|
| 致命 | `core/schema.ts` の独立ファイル化 | `parser.ts` に統合 |
| 致命 | `generator.ts` 非公開関数4本の設計時宣言 | 設計書から削除し実装時に判断 |
| 重要 | `--screen` オプションのv1スコープ確認 | module-designerと要確認 |
| 重要 | `validator.ts` の警告ルール2件の欠落 | `checkErrorTypeMissing` / `checkBoundaryTypeMissing` を追加 |
| 軽微 | `ParseError` / `ValidationIssue` の混乱リスク | コメントで明記 |
| 軽微 | `utils/output.ts` のテスト戦略 | v1では許容 |

**設計変更後のファイル数**: 7ファイル（`schema.ts`を`parser.ts`に統合で-1）
これでもv1（2コマンド）に対して適切な粒度と判断する。
