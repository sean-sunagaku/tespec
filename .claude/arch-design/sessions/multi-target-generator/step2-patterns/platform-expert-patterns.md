# Platform Expert パターン提案

作成日: 2026-03-25
担当: platform-expert（TypeScript / oclif / tsup 固有の観点）

---

## パターン A: 静的 Record Registry + oclif Flags.option()

### 概要
`Record<Target, GeneratorFn>` を `src/core/generator-registry.ts` に定義し、`generate.ts` から `Flags.option()` で選択する最もシンプルな構成。

### 構造
```
src/
  core/
    generator-registry.ts   ← Record<Target, { generate: GeneratorFn; fileExt: string }>
    generator.ts             ← Playwright 実装（現状維持 or 後方互換 re-export）
    generator-swift.ts       ← XCTest 実装（現状維持）
  commands/
    generate.ts              ← Flags.option({ options: ['playwright', 'xctest'] })
```

### 実装イメージ
```typescript
// generator-registry.ts
export const TARGET_OPTIONS = ['playwright', 'xctest'] as const;
export type Target = typeof TARGET_OPTIONS[number];

export const REGISTRY: Record<Target, { generate: GeneratorFn; fileExt: string }> = {
  playwright: { generate: generateTestFile,      fileExt: 'spec.ts' },
  xctest:     { generate: generateSwiftTestFile, fileExt: 'swift'   },
};

// generate.ts
static flags = {
  target: Flags.option({ options: TARGET_OPTIONS as unknown as string[], default: 'playwright', char: 't' })(),
};
// run() 内
const entry = REGISTRY[flags.target as Target];
```

### メリット
- 実装量が最小（新規ファイル1つ + generate.ts の小変更のみ）
- `Record<Target, ...>` の網羅性チェックにより、新 target 追加時の登録漏れをコンパイルエラーで検出
- tsup の entry 変更不要、ESM の dynamic import 不要
- vitest でのテストが純粋関数のままで容易
- oclif v4 の `Flags.option()` と相性が良い

### デメリット/リスク
- `flags.target` は `string` 型のため `as Target` キャストが必要（型安全性の小さな穴）
- 全 generator が常に bundle に含まれる（現状規模では問題なし）
- generator 数が10以上に増えた場合、registry ファイルが肥大化する可能性

### 向いているケース
- 対応フレームワーク数が少ない（2〜5程度）
- 追加頻度が低い
- 現状のコードベース規模（最優先候補）

---

## パターン B: oclif サブコマンド分割（generate:playwright / generate:xctest）

### 概要
`generate` コマンドをサブコマンドに分割し、oclif のコマンドツリーで表現する。`tespec generate:playwright` / `tespec generate:xctest` のような CLI UX。

### 構造
```
src/
  commands/
    generate/
      index.ts        ← 後方互換: generate の基底（デフォルト = playwright）
      playwright.ts   ← generate:playwright コマンド
      xctest.ts       ← generate:xctest コマンド
  core/
    generator.ts
    generator-swift.ts
    generator-base.ts  ← 共通ロジック（BaseGenerateCommand 基底クラス）
```

### 実装イメージ
```typescript
// core/generator-base.ts
abstract class BaseGenerateCommand extends Command {
  static baseFlags = { config: ..., screen: ..., 'dry-run': ..., 'out-dir': ... };
  abstract get fileExt(): string;
  abstract generateContent(screen: Screen, setups: Setup[]): string;
  async run() { /* 共通ロジック */ }
}

// commands/generate/playwright.ts
export default class GeneratePlaywright extends BaseGenerateCommand {
  static id = 'generate:playwright';
  get fileExt() { return 'spec.ts'; }
  generateContent = generateTestFile;
}
```

### メリット
- oclif の自動 help (`tespec --help`) でフレームワーク一覧が表示される
- コマンドごとに独立しているため単体テストしやすい
- `src/commands/*.ts` の glob が `src/commands/generate/*.ts` を自動収集する（tsup 変更不要）
- 新フレームワーク = 新ファイル追加のみで完結（開閉原則に忠実）

### デメリット/リスク
- 後方互換性の確保が複雑: 既存ユーザーの `tespec generate` が壊れないよう `generate/index.ts` の扱いを慎重に設計する必要がある
- oclif のサブコマンド routing（`generate` と `generate:playwright` の共存）はバージョンによって挙動差異あり。v4 での動作検証が必要
- 抽象基底クラスの導入でコード量が増える
- `abstract class` は TypeScript の ESM + NodeNext で問題なく動作するが、oclif の Command 継承との多重継承は不可（単一継承のみ）

### 向いているケース
- フレームワーク数が多く（5以上）、それぞれ固有のオプションを持つ
- CLI の UX として `tespec generate:xctest` のような明示的なサブコマンドが望ましい
- 中〜長期的な拡張性を重視する場合

---

## パターン C: Generator Interface + factory function（型安全な中間案）

### 概要
`GeneratorPlugin` インターフェースを定義し、factory function で target 文字列から generator を返す。パターン A より型安全で、パターン B より軽量。

### 構造
```
src/
  core/
    generator-plugin.ts    ← GeneratorPlugin interface + factory
    generator.ts           ← Playwright 実装
    generator-swift.ts     ← XCTest 実装
  commands/
    generate.ts            ← factory 呼び出し
```

### 実装イメージ
```typescript
// generator-plugin.ts
export interface GeneratorPlugin {
  readonly target: string;
  readonly fileExt: string;
  generate(screen: Screen, setups: Setup[]): string;
}

const plugins: GeneratorPlugin[] = [
  { target: 'playwright', fileExt: 'spec.ts', generate: generateTestFile },
  { target: 'xctest',     fileExt: 'swift',   generate: generateSwiftTestFile },
];

export function resolveGenerator(target: string): GeneratorPlugin {
  const plugin = plugins.find((p) => p.target === target);
  if (!plugin) throw new Error(`Unknown target: ${target}`);
  return plugin;
}

export const VALID_TARGETS = plugins.map((p) => p.target);
```

### メリット
- `GeneratorPlugin` インターフェースが明示的な契約として機能する
- `VALID_TARGETS` を動的に生成するため、oclif の `Flags.option({ options: VALID_TARGETS })` と連動できる（新 target 追加で options も自動更新）
- `resolveGenerator` が runtime エラーを一点で処理するため、`generate.ts` 側のエラーハンドリングが不要
- パターン A の `as Target` キャストが不要

### デメリット/リスク
- パターン A と比べて `Record` の網羅性チェックがない（`plugins` 配列への追加漏れはコンパイルエラーにならない）
- `VALID_TARGETS` が `string[]` 型になるため、oclif の `Flags.option()` との型の整合が若干複雑（`as string[]` キャスト依然必要）
- factory 関数の runtime エラーは vitest でのテストカバレッジが必要

### 向いているケース
- インターフェースによる明示的な契約を重視する
- 将来的に外部パッケージからの generator 登録（プラグイン機構）を検討している
- パターン A より少し型安全にしたいが、パターン B のサブコマンド構造は過剰と感じる場合

---

## platform-expert 推奨

**現状の規模・要件には パターン A が最適。**

理由:
1. 実装コストが最小で、既存コードへの変更箇所が最も少ない
2. `Record<Target, ...>` の網羅性チェックで型安全性を担保できる
3. tsup / oclif v4 / ESM の制約に対して最もシンプルに収まる
4. `generator-swift.ts` の「未接続状態」を解消する最短経路

将来フレームワーク数が5以上になった、または CLI UX として明示的なサブコマンドが求められた時点でパターン B への移行を検討するのが自然な進化経路。
