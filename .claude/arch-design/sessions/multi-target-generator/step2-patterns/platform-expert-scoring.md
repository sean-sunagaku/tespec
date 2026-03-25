# Platform Expert スコアリング

作成日: 2026-03-25
担当: platform-expert
評価軸:
- **スタック適合性 (1-5)**: TypeScript 6.x / oclif v4 / ESM only (`"type":"module"`) / tsup 環境で無理なく実装できるか。5=制約なし、1=根本的な阻害要因あり
- **学習コスト (1-5)**: 小規模 CLI プロジェクトの文脈でコード理解・保守に必要な認知コスト。5=低コスト（シンプル）、1=高コスト（複雑）

---

## スコアリング表

| # | パターン名 | スタック適合性 | 学習コスト | 合計 | 判定 |
|---|-----------|:---:|:---:|:---:|------|
| 1 | Static Record Registry | 5 | 5 | 10 | 最推奨 |
| 2 | if/switch 分岐 | 5 | 5 | 10 | 初期のみ可・拡張性ゼロ |
| 3 | oclif サブコマンド分割 | 3 | 3 | 6 | 後方互換リスクあり |
| 4 | abstract BaseGenerator クラス | 4 | 3 | 7 | 可だが過剰 |
| 5 | Plugin Interface + factory | 5 | 4 | 9 | 次善策 |
| 6 | Dynamic import (lazy loading) | 2 | 3 | 5 | ESM制約で要注意 |
| 7 | DI コンテナ (tsyringe 等) | 1 | 1 | 2 | 不採用 |
| 8 | Strategy パターン (クラスベース) | 4 | 3 | 7 | 可だが過剰 |
| 9 | テンプレートエンジン (Mustache 等) | 3 | 2 | 5 | 不採用 |
| 10 | Generator function + yield | 4 | 2 | 6 | 不採用 |

---

## 各パターン詳細評価

### パターン 1: Static Record Registry ★★★★★
**スタック適合性: 5 / 学習コスト: 5**

- ESM static import のみ。tsup の entry 変更不要
- `Record<FrameworkId, FrameworkGenerator>` は TypeScript の網羅性チェックが働く（新 framework 追加で登録漏れをコンパイルエラーで検出）
- `FRAMEWORK_IDS as const` → `typeof FRAMEWORK_IDS[number]` で oclif `Flags.option()` との型同期が1箇所で済む
- コードを読んだ人が即座に全体を把握できる（registry ファイル1つ見れば対応 framework 一覧が分かる）
- **合計 10 / 10**

---

### パターン 2: if/switch 分岐
**スタック適合性: 5 / 学習コスト: 5**

- 実装コストは最小（新規ファイル不要）
- ただし architecture-lead の試算通り、差異が3〜4関数に散在すると 40〜60行の分岐になり学習コストは急増する
- **今の2フレームワークなら問題ないが、3つ目で破綻が確定** → 採用すべきでない
- 上表では「現時点のシンプルさ」として 5 を付けたが、拡張性を考慮すると実質 2 相当
- **合計 10 / 10（見かけ上）→ 実質非推奨**

---

### パターン 3: oclif サブコマンド分割
**スタック適合性: 3 / 学習コスト: 3**

スタック適合性の減点理由:
- oclif v4 での `generate` と `generate:playwright` の共存は動作確認が必要
  - `oclif.commands: "./dist/commands"` の自動スキャンで `commands/generate/index.js` と `commands/generate/playwright.js` が共存するケースの挙動がバージョン依存
  - `dist/commands/generate.js`（既存）と `dist/commands/generate/` ディレクトリの競合リスクがある
- 後方互換の `tespec generate`（引数なし）を維持するには `generate/index.ts` に特別な処理が必要

学習コストの減点理由:
- oclif のサブコマンド routing を理解していないと `--help` 出力や引数解析の挙動が予測しにくい
- 抽象基底クラスの導入でファイル数が増える

**合計 6 / 10**

---

### パターン 4: abstract BaseGenerator クラス
**スタック適合性: 4 / 学習コスト: 3**

スタック適合性:
- TypeScript + ESM での `abstract class` は問題なく動作する
- oclif の `Command` と多重継承はできないため、`BaseGenerator` は oclif とは独立して設計する必要がある
- tsup のバンドル対象に影響なし

学習コスト:
- テンプレートメソッドパターンは設計経験が必要（`abstract` メソッドと `protected` メソッドの境界を決める判断が難しい）
- 現状の generator は純粋関数で実装されているため、クラスへの移行で認知モデルが変わる

**合計 7 / 10**

---

### パターン 5: Plugin Interface + factory
**スタック適合性: 5 / 学習コスト: 4**

スタック適合性:
- ESM static import で完結。dynamic import 不要
- `interface` ベースなので TypeScript の制約に最も自然に合う
- oclif との統合もパターン 1 と同等

学習コスト:
- パターン 1 と比べて `resolveGenerator(id)` の runtime エラーパスが存在する（型安全性の穴）
- `VALID_TARGETS` が `string[]` 型になるため oclif との連携で微妙なキャストが残る
- パターン 1 の `Record` 網羅性チェックがないため、registry 配列への追加漏れがコンパイルエラーにならない

**合計 9 / 10（次善策として有効）**

---

### パターン 6: Dynamic import (lazy loading)
**スタック適合性: 2 / 学習コスト: 3**

スタック適合性の減点理由（重要）:
- `moduleResolution: NodeNext` + tsup の組み合わせでは dynamic import のパスが実行時に解決されるため、tsup がバンドル境界を正しく判断できない場合がある
- `await import(`./generators/${id}.js`)` のテンプレートリテラルは **tsup が静的解析できない**。バンドル後に `dist/core/generators/playwright.js` が存在することを保証するには tsup の entry に明示的に追加が必要
- 返り値が `unknown` 型になるため型アサーションが必須
- `"type": "module"` 環境では動作するが、上記の tsup バンドル問題で実運用リスクが高い

学習コスト:
- dynamic import のエラーハンドリング（存在しない id を渡した場合の runtime エラー）が必要
- Top-level await / async context の扱いが必要

**合計 5 / 10**

---

### パターン 7: DI コンテナ (tsyringe 等)
**スタック適合性: 1 / 学習コスト: 1**

スタック適合性:
- `tsyringe` は `reflect-metadata` を必要とし、`tsconfig.json` に `"experimentalDecorators": true` と `"emitDecoratorMetadata": true` の追加が必要
- 現在の tsconfig にこれらの設定なし。TypeScript 6.x ではデコレータ仕様が変わっているため追加のリスクあり
- ESM + tsup 環境での `reflect-metadata` の動作に既知の問題がある

学習コスト:
- DI の概念、デコレータ、メタデータの理解が必要
- 小規模 CLI に対して過大な複雑性

**合計 2 / 10（採用不可）**

---

### パターン 8: Strategy パターン (クラスベース)
**スタック適合性: 4 / 学習コスト: 3**

スタック適合性:
- TypeScript + ESM でクラスは問題なく動作する
- 現状の generator が純粋関数ベースなのに対し、クラスへの移行が必要
- tsup・oclif との統合は問題なし

学習コスト:
- パターン 4 と同様、現状の関数ベースからクラスベースへの認知モデルの転換が必要
- `Context` クラスの役割が generate.ts と重複する可能性がある
- パターン 1 の Record Registry で同等の切り替えが関数ベースで実現できるため、クラス化のメリットが薄い

**合計 7 / 10**

---

### パターン 9: テンプレートエンジン (Mustache 等)
**スタック適合性: 3 / 学習コスト: 2**

スタック適合性:
- `mustache` や `handlebars` は ESM 対応しているが、tespec への依存追加が必要
- テンプレートファイル（`.mustache`）を `dist/` にバンドルするには tsup の `publicDir` や `copy` 設定が必要 → entry 変更が発生
- TypeScript の型安全性がテンプレート内では失われる

学習コスト:
- テンプレート構文の習得が別途必要
- `// TODO: implement` のようなコード生成はテンプレートエンジンの得意領域ではない（ロジックが多い）
- デバッグ時にテンプレート展開結果の把握が難しい

**合計 5 / 10（採用不可）**

---

### パターン 10: Generator function + yield
**スタック適合性: 4 / 学習コスト: 2**

スタック適合性:
- TypeScript + ESM で Generator 関数は問題なく動作する
- tsup のバンドル対象に影響なし

学習コスト:
- `function*` / `yield` の概念とイテレータプロトコルの理解が必要
- 現状の `string[]` を join する実装より可読性が上がるケースは限定的
- 行単位のストリーム出力が必要な場面（大規模ファイル生成）には有効だが、テストスケルトン生成（数百行程度）には過剰
- 他のチームメンバーが保守する際の認知コストが高い

**合計 6 / 10（採用不可）**

---

## platform-expert 推奨順位

1. **パターン 1（Static Record Registry）** — 採用決定済みと一致。全制約をクリア
2. **パターン 5（Plugin Interface + factory）** — パターン 1 の次善策。将来のプラグイン機構を見越す場合
3. **パターン 4 / 8（抽象クラス / Strategy）** — 技術的には可能だが現状規模には過剰
4. **パターン 3（oclif サブコマンド）** — oclif v4 の動作検証コストが高く、後方互換リスクあり
5. **パターン 6（Dynamic import）** — tsup との相性問題で実運用リスクが高い
6. **パターン 7（DI コンテナ）** — tsconfig 変更が必要で採用不可
7. **パターン 9 / 10（テンプレートエンジン / yield）** — ユースケース不一致で採用不可
