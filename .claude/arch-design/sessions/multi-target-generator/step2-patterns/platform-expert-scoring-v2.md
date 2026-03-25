# Platform Expert スコアリング v2（正式版）

作成日: 2026-03-25
担当: platform-expert
対象: generator 拡張パターン 10案（P01〜P10）

評価軸:
- **スタック適合性**: TypeScript 6.x / oclif v4 / ESM only (`"type":"module"`) / tsup / Node >=18 環境での実現可能性
  - 高: 制約なし、追加設定不要
  - 中: 軽微な追加対応が必要（キャスト、設定変更等）
  - 低: 根本的な阻害要因あり、または実運用リスクが高い

---

## スコアリング表

| # | パターン名 | スタック適合性 | 理由サマリー |
|---|-----------|:---:|------|
| P01 | 内部分岐（if/switch） | 高 | 追加依存なし。ただし拡張性は別問題 |
| P02 | 静的 Record Registry（合意案） | 高 | 全制約クリア。`Record` の網羅性チェックが型安全性を担保 |
| P03 | Strategy パターン（クラスベース） | 高 | TypeScript + ESM でクラスは問題なし。oclif と独立して設計可能 |
| P04 | Template Method パターン | 高 | P03 と同等。abstract class は TypeScript 6.x で動作 |
| P05 | 関数オブジェクト Registry（軽量変形） | 高 | P02 より型定義が少ない。oclif との連携も同等 |
| P06 | Builder パターン | 中 | 技術的に可能だがメソッドチェーンの型推論が複雑になりやすい |
| P07 | Pipes & Filters | 中 | 関数合成自体は ESM で問題なし。型の伝播設計に注意が必要 |
| P08 | Plugin / dynamic import | 低 | tsup の静的解析不可・バンドル漏れリスクあり（後述） |
| P09 | テンプレートエンジン（Handlebars / EJS） | 低 | 依存追加 + tsup でのテンプレートファイルバンドル設定が必要 |
| P10 | AST / CodeWriter ベース | 中 | ts-morph 等は ESM 対応済み。ただし実装コストが桁違いに高い |

---

## 詳細評価

### P01: 内部分岐（if/switch）
**スタック適合性: 高**

- 追加依存なし、tsup entry 変更不要、oclif 変更最小
- スタック上の制約は何もない
- ただし architecture-lead の試算通り「`renderNestedGroup` / `renderCase` / `generateTestFile` の外枠」にまたがる分岐が発生し、3フレームワーク目で読解不能になる
- **スタック適合性は高いが設計上の問題であり、このスコアリングの範囲外**

### P02: 静的 Record Registry（合意案）
**スタック適合性: 高**

- `FRAMEWORK_IDS as const` → `typeof FRAMEWORK_IDS[number]` で oclif `Flags.option()` との型同期が1箇所
- `Record<FrameworkId, FrameworkGenerator>` は TypeScript コンパイラが全キーの存在を強制する（網羅性チェック）
- ESM static import のみ。tsup の entry 変更不要
- `moduleResolution: NodeNext` の `.js` 拡張子制約に対して static import は問題なし
- **全制約に対してクリア。追加設定ゼロ**

### P03: Strategy パターン（クラスベース）
**スタック適合性: 高**

- TypeScript + ESM での `class` は問題なく動作する
- oclif の `Command` 基底クラスと多重継承はできないが、`FrameworkGenerator` は oclif とは独立した層なので問題なし
- tsup のバンドル対象に影響なし
- 現状の generator が純粋関数ベースのため、**クラスへの移行は設計判断であり技術制約ではない**

### P04: Template Method パターン
**スタック適合性: 高**

- P03 と同等。`abstract class` + `protected` メソッドは TypeScript 6.x で動作確認済みの構文
- `abstract` メソッドのオーバーライド強制はコンパイルエラーで検出されるため、P02 の `Record` 網羅性チェックと同等の安全性
- tsup・ESM・oclif 上の制約なし

### P05: 関数オブジェクト Registry（軽量変形）
**スタック適合性: 高**

- P02 と構造は同じ。interface の代わりに `type GeneratorFn = (screen: Screen, setups: Setup[]) => string` のみ
- `fileExtension` / `fileNameFor` を別 Map で管理する場合、型の一貫性がやや弱まる（Map と Registry の同期が手動になる）
- oclif との連携はP02と同等
- **技術制約なし。ただし P02 より型の表現力が弱い**

### P06: Builder パターン
**スタック適合性: 中**

- メソッドチェーン自体は TypeScript + ESM で動作する
- 課題: `setFramework()` の後に型が絞り込まれる「型安全なビルダー」を実装しようとすると、TypeScript のジェネリクス推論が複雑になる
  ```typescript
  // 単純実装では framework 未設定で build() を呼べてしまう
  new TestFileBuilder().build(); // runtime エラー、コンパイルエラーにならない
  ```
- 型安全なビルダーには phantom type や conditional type が必要 → TypeScript 6.x では可能だが認知コスト高
- generate コマンドからの使用パターンとして「毎回 new する」設計になるため oclif との相性は問題なし
- **技術的に可能だが型安全性を担保しようとすると設計が複雑化する**

### P07: Pipes & Filters
**スタック適合性: 中**

- 関数合成は ESM + TypeScript で問題なく動作する
- 課題: フィルター間でやり取りするデータ型（中間表現）の設計が必要
  ```typescript
  type PipelineContext = { screen: Screen; setups: Setup[]; lines: string[] };
  type Filter = (ctx: PipelineContext) => PipelineContext;
  ```
- 各フィルターを純粋関数として実装すれば vitest でのテストは容易
- oclif / tsup への影響なし
- **技術制約はないが、中間表現の型設計コストがかかる**

### P08: Plugin / dynamic import（遅延ロード）
**スタック適合性: 低**

**根本的な問題: tsup との相性**

```typescript
// この形式は tsup が静的解析できない
const generator = await import(`./generators/${framework}.js`);
```

- tsup はバンドル時に `import()` の引数を静的解析してバンドル対象を決定する
- テンプレートリテラルは解析不能なため、`dist/core/generators/playwright.js` 等が**バンドル後に存在しない**可能性がある
- 回避策: tsup の `entry` に各 generator ファイルを明示追加
  ```typescript
  entry: ['src/cli.ts', 'src/commands/*.ts', 'src/core/generators/*.ts'],
  ```
  → entry 変更が必要で「新フレームワーク追加時に registry への登録不要」というメリットが消える
- 返り値が `unknown` 型になり、型アサーション (`as FrameworkGenerator`) が必要
- エラーハンドリング（存在しない framework ID を渡した場合）が runtime のみ
- **ESM + Node18 では動作するが、tsup バンドルとの組み合わせで実運用リスクが高い**

### P09: テンプレートエンジン（Handlebars / EJS）
**スタック適合性: 低**

**問題1: 依存追加**
- `handlebars` / `ejs` を `dependencies` に追加が必要
- 現在の dependencies は最小限（@oclif/core, picocolors, yaml, zod）。テンプレートエンジンはバンドルサイズを増加させる

**問題2: tsup でのテンプレートファイルバンドル**
- `.hbs` / `.ejs` ファイルを `dist/` に含めるには tsup の設定変更が必要
  ```typescript
  // tsup.config.ts に追加が必要
  publicDir: 'src/templates',
  // または copy オプション等
  ```
- tsup ^8.5.1 では `publicDir` は存在しない。`esbuild-plugin-copy` 等の追加が必要
- テンプレートの読み込みパスが実行時解決になり、CLI の配布パッケージ（`dist/` のみ）に含まれるかの検証が必要

**問題3: 型安全性の喪失**
- テンプレート内でのスコープ変数は `any` 相当になる
- TypeScript の型チェックがテンプレート内では働かない

**スタック適合性: 低（設定変更 + 依存追加 + 型安全性低下の三重課題）**

### P10: AST / CodeWriter ベース
**スタック適合性: 中**

- `ts-morph` は ESM 対応済み（v21+）、Node 18 対応
- TypeScript Compiler API は TypeScript 本体に含まれるため追加依存なし
- ただし `ts-morph` を使う場合は `dependencies` への追加が必要

**技術的には可能だが実装コストが桁違い:**
- テストスケルトン生成（本質: 文字列テンプレート）に AST を使うのは過剰
- `ts-morph` でのコード生成は学習コストが高い
- 独自 AST の場合はさらに Parser / Printer の実装が必要
- tsup のバンドル対象に含めるには `ts-morph` のファイルI/O依存を考慮が必要

**スタック適合性: 中（技術的には可能、実装コストが問題）**

---

## 特別評価項目（architecture-lead 指定）

### P08 の ESM 制約詳細

`"type": "module"` + `moduleResolution: NodeNext` 環境での dynamic import:

```typescript
// 動作する形式（パスが静的）
const mod = await import('./generators/playwright.js');

// tsup で問題になる形式（パスが動的）
const mod = await import(`./generators/${framework}.js`);
```

tsup はビルド時に後者のパターンを解析できないため、バンドル後の `dist/` に `generators/playwright.js` が含まれない可能性がある。
Node.js の ESM 自体はどちらも動作するが、tsup バンドルの制約により**CLIとして配布した際に動作しない**リスクがある。

### P09 の依存追加コスト

| 項目 | コスト |
|------|--------|
| `handlebars` 追加 | npm install + types |
| tsup へのファイルコピー設定 | プラグイン追加または esbuild オプション |
| テンプレートファイル管理 | `src/templates/` ディレクトリ追加 |
| 型安全性の喪失 | テンプレート変数が `any` 相当 |
| デバッグコスト | テンプレート展開後の出力確認が必要 |

現在の依存最小化方針（zod, yaml, picocolors, @oclif/core のみ）と相反する。

### P10 の実装難度

独自 AST の場合:
1. テスト構造の意味表現（`TestSuite`, `TestCase`, `TestGroup` ノード）の定義
2. `Screen → AST` の変換層
3. `AST → string` の Printer（フレームワークごと）
4. ノード訪問の実装（Visitor パターンが必要）

ts-morph の場合:
1. ts-morph の API 学習
2. TypeScript AST でのテスト構造生成
3. ファイル書き出しとバッファ管理

どちらも現状の「文字列配列を join する」実装の複雑度と比較して**10〜20倍の実装量**になる。

---

## platform-expert 推奨順位（スタック適合性の観点のみ）

1. **P02（静的 Record Registry）** — 全制約クリア、追加設定ゼロ
2. **P05（関数オブジェクト Registry）** — P02 と同等。型の表現力が若干弱いだけ
3. **P03 / P04（Strategy / Template Method）** — 技術的に可能。設計の複雑度は別問題
4. **P07（Pipes & Filters）** — 中間表現の設計コストがかかるが技術制約なし
5. **P06（Builder）** — 型安全なビルダーの実装が複雑化しやすい
6. **P10（AST）** — 技術的には可能だが実装コストが桁違い
7. **P01（内部分岐）** — スタック制約なし。設計上の問題のみ
8. **P08（dynamic import）** — tsup バンドルとの相性問題で実運用リスクあり
9. **P09（テンプレートエンジン）** — 依存追加 + tsup 設定変更 + 型安全性低下
