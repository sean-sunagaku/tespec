# Devil's Advocate: シンプルさスコアリング

## 評価基準（再掲）

- **既存コードとの差分量**: 変更が少ないほど高スコア
- **導入する新概念の数**: 少ないほど高スコア
- **YAGNI 違反・過剰抽象化**: 違反がないほど高スコア

スコア: 1（複雑/YAGNI違反）〜 5（シンプル/YAGNI準拠）

---

## スコアリング結果

| # | パターン名 | スコア | 一言評価 |
|---|-----------|:------:|---------|
| 1 | 完全ミラー縦割り | **4** | 既存慣習の忠実な踏襲。新概念ゼロ |
| 2 | 共通バリデーター基盤抽出 | **3** | 型共通化は良いが、既存2ファイルの改変コストが発生 |
| 3 | SpecType レジストリ（プラグイン型） | **1** | 明確なYAGNI違反。spec 3種類での汎用化は過剰 |
| 4 | Workflow-as-Screen 拡張 | **2** | ファイル数最少だが ScreenSchema の意味論が崩壊する |
| 5 | 水平レイヤー追記（最小変更） | **3** | ファイル数は減るが既存ファイルの責務が曖昧化する |
| 6 | Workflow サブドメインモジュール | **3** | 境界明確だが新ディレクトリ構造という新概念を導入 |
| 7 | Composite Spec（統合スキーマ） | **1** | Zod discriminatedUnion + 既存スキーマ改造 = 高コスト |
| 8 | Workflow → Screen 変換パイプライン | **2** | 意味論の強引な同化。デバッグ困難でユーザー体験が悪化 |
| 9 | ParsedProject の汎用 SpecCollection 化 | **1** | 明確なオーバーエンジニアリング。全面書き換えが必要 |
| 10 | Workflow-only CLI コマンド分離 | **3** | 既存コマンド無変更は魅力的だが、UX分断と Viewer 統合困難 |

---

## 詳細スコア根拠

### 案1: 完全ミラー縦割り — **4点**

**既存差分量**: 小〜中
- 新設ファイル: `workflow-validator.ts`, `generators/workflow/playwright.ts`
- 変更ファイル: `schema.ts`（追記）, `parser.ts`（ParsedProject拡張）, `validate.ts`, `generate.ts`
- 既存パターンの繰り返しなので変更内容が予測しやすい

**新概念の数**: 0
- WorkflowSchema / WorkflowGenerator は Screen/Unit のパターンを踏襲するだけ
- 新しいアーキテクチャ概念は導入しない

**YAGNI評価**: 適切
- 必要なものだけを、既知のパターンで追加している

**減点理由（-1点）**: `ParsedProject` に `workflows` フィールドが増えて肥大化の傾向が続く点。`validate.ts` / `generate.ts` の分岐も spec タイプ数に比例して増加する。これは将来のコストだが、現時点では許容範囲。

---

### 案2: 共通バリデーター基盤抽出 — **3点**

**既存差分量**: 中
- 案1 の全作業 + `validation-types.ts` 新設 + 既存 `validator.ts` / `unit-validator.ts` の import リファクタリング

**新概念の数**: 1（validation-types.ts という共通型モジュール）
- これ自体は合理的だが、「今 Workflow を追加するついでにリファクタリングもする」という複合作業になる

**YAGNI評価**: 軽微な問題
- `ValidationIssue` の重複は現在 2 箇所（validator.ts と unit-validator.ts）。Workflow 追加で 3 箇所になるが、フィールドが変わっていないため「今すぐ共通化が必要」とは言えない
- リファクタリングのタイミングとして Workflow 追加を使うのは合理的だが、スコープが広がるリスクがある

**減点理由（-2点）**: 既存ファイル 2 つへの改変が必要 + 作業スコープが広がる。

---

### 案3: SpecType レジストリ（プラグイン型） — **1点**

**既存差分量**: 大（既存 screen/unit の全面リファクタリング）

**新概念の数**: 多い
- `SpecTypeRegistry` インターフェース
- `spec-types/` ディレクトリ構造
- データ駆動型の spec 登録パターン
- 複雑な TypeScript ジェネリクス

**YAGNI評価**: 明確な違反
- spec タイプが 3 つ（screen/unit/workflow）で汎用レジストリを作るのは Rule of Three 未満での過剰抽象化
- 「将来の第 4 タイプ追加を楽にする」という動機だが、第 4 タイプがいつ来るか不明
- 既存 screen/unit を新しい構造に移行する工数が Workflow 実装工数を上回る可能性がある

---

### 案4: Workflow-as-Screen 拡張 — **2点**

**既存差分量**: 最小（新ファイルほぼゼロ）

**新概念の数**: 少ない
- `type: 'screen' | 'workflow'` フラグのみ

**YAGNI評価**: 問題あり
- ファイル数最少という表面的なシンプルさと引き換えに、スキーマの意味論を破壊する
- `screen.route` が workflow には不要（空文字列やダミーを入れる運用になる）
- `cases` が workflow には不要（空配列を入れる運用になる）
- 「シンプル」に見えて実は意味不明な nullable フィールドが増える「偽シンプル」

**減点理由（-3点）**: スキーマ汚染は将来の全ての機能追加にコストを課す。ファイル数の節約と引き換えに意味論的正確さを失うのは割に合わない。

---

### 案5: 水平レイヤー追記（最小変更） — **3点**

**既存差分量**: 中（既存ファイルへの追記なので diff は分散）

**新概念の数**: 0

**YAGNI評価**: 適切
- 追加する機能だけを最小コストで実装する発想は正しい

**減点理由（-2点）**:
- `validator.ts` が「screen validator + workflow validator」の混在ファイルになり、ファイル名と内容が乖離する
- `schema.ts` が全 spec タイプのスキーマを持つモノリシックファイルになる（現在 59行、Workflow 追加後は 90行超）
- 「ファイル数が少ない」と「コードが読みやすい」は別の話

---

### 案6: Workflow サブドメインモジュール — **3点**

**既存差分量**: 中
- `src/core/workflow/` ディレクトリ新設
- 既存ファイルへの変更は ConfigSchema / ParsedProject / コマンドの呼び出し部分のみ

**新概念の数**: 1〜2
- サブドメインディレクトリパターン（既存の `src/core/` トップレベル慣習からの逸脱）
- `index.ts` barrel export（現在のコードベースに barrel export は存在しない）

**YAGNI評価**: 軽微な問題
- Workflow の自己完結性は良いが、既存 Screen/Unit がこのパターンを使っていないため非対称
- `barrel export` は現在のコードベースに存在しない新たな慣習の導入

**減点理由（-2点）**: 既存の screen/unit との非対称性。barrel export という新慣習の導入。ディレクトリネストの深さ（`src/core/workflow/generators/playwright.ts`）。

---

### 案7: Composite Spec（統合スキーマ） — **1点**

**既存差分量**: 大（既存スキーマの構造変更が必要）

**新概念の数**: 多い
- `z.discriminatedUnion` パターン（現在不使用）
- `AnySpec` Union 型
- 汎用 `getGenerator(spec: AnySpec)` インターフェース
- 既存 YAML の `screen: login` を `type: screen` 形式に変える可能性

**YAGNI評価**: 過剰
- 「パーサーが spec タイプを自動判別できる」という恩恵は、ディレクトリ分離（screens_dir / workflows_dir）で既に実現されている
- 既存 YAML フォーマットの変更を強いる可能性があり、後方互換性のリスクがある

---

### 案8: Workflow → Screen 変換パイプライン — **2点**

**既存差分量**: 小（Generator を新設しない点は評価できる）

**新概念の数**: 1（`workflow-expander.ts` という変換レイヤー）

**YAGNI評価**: 問題あり
- 「Generator を新設しない」という利点のために意味論的に無理なマッピングを行う
- Workflow フロー全体を 1 テスト関数で表現したいのに、Screen 単位に分解してしまう
- 変換後のコードが「元は Workflow だった」情報を失う → デバッグ時にユーザーが混乱

**減点理由（-3点）**: 表面的な差分削減のために意味論的正確さを犠牲にする「偽シンプル」。

---

### 案9: ParsedProject の汎用 SpecCollection 化 — **1点**

**既存差分量**: 最大（`ParsedProject` 全面書き換え + 全ての呼び出し箇所の変更）

**新概念の数**: 多い
- `SpecCollection` 型
- `Map<SpecType, unknown[]>` パターン
- 複雑な TypeScript ジェネリクス
- アクセサー API

**YAGNI評価**: 明確な違反（Architecture Lead も「明らかなオーバーエンジニアリング」と評価）
- `parsed.result.screens` という直感的なアクセスが失われる
- 型安全性の維持が困難

---

### 案10: Workflow-only CLI コマンド分離 — **3点**

**既存差分量**: 中
- 既存コマンドへの変更ゼロは魅力的
- ただし `src/commands/workflow/validate.ts` / `generate.ts` を新設する

**新概念の数**: 1（サブコマンド階層構造）

**YAGNI評価**: 軽微な問題
- 「既存コマンドへの変更ゼロ」という制約を守るために、UX が二分される
- `tespec validate` が全 spec を検証しないという状態は、ユーザーが混乱しやすい
- Viewer 統合が困難（ParsedProject に workflows が入らない）

**減点理由（-2点）**: UX 分断リスクと Viewer 統合困難が将来のコストになる。

---

## 総合順位（シンプルさ観点）

| 順位 | 案 | スコア | 推奨理由 |
|------|---|:------:|---------|
| 1位 | 案1: 完全ミラー縦割り | **4** | 既存慣習踏襲・新概念ゼロ・YAGNI適切 |
| 2位（同率）| 案2: 共通バリデーター基盤抽出 | **3** | 型共通化は合理的、ただし作業スコープが広がる |
| 2位（同率）| 案5: 水平レイヤー追記 | **3** | ファイル数最少だが責務が曖昧化する |
| 2位（同率）| 案6: Workflow サブドメインモジュール | **3** | 境界明確だが既存との非対称性あり |
| 2位（同率）| 案10: Workflow-only CLI コマンド分離 | **3** | 既存コマンド無変更は良いがUX分断リスク |
| 3位 | 案4: Workflow-as-Screen拡張 | **2** | スキーマ汚染は長期コスト大 |
| 3位 | 案8: Workflow→Screen変換 | **2** | 意味論の強引な同化 |
| 最下位 | 案3, 7, 9 | **1** | 明確なYAGNI違反/過剰設計 |

## Devil's Advocate の推奨

**案1（完全ミラー縦割り）を推奨**。スコア 4 は完璧ではないが、他案と比べて「既存慣習を踏襲しており読み手に驚きがない」という点が最大の強み。

ただし Step 1 で指摘した以下の問題は案1では解決されない点に注意:
- Screen-Workflow の action 整合性問題（二重管理リスク）
- Generator は Phase 1 では不要（Workflow の実運用前に Generator の有用性が不明）

**案1 の MVP 版として**: Generator を含む `generators/workflow/playwright.ts` を Phase 2 に先送りすれば、実装スコープが更に小さくなりスコアは実質 **4.5** 相当になる。
