# Platform Expert Feedback — TypeScript / oclif / tsup 固有の制約分析

作成日: 2026-03-25
担当: platform-expert

---

## 1. スタック概要（確認済み事実）

| 項目 | 現状 |
|------|------|
| パッケージタイプ | `"type": "module"` — ESM only |
| Node.js 要件 | `>=18` |
| oclif バージョン | `@oclif/core` ^4.10.2 |
| tsup | ^8.5.1、`format: ['esm']` のみ |
| TypeScript | ^6.0.2、`module: NodeNext`、`moduleResolution: NodeNext` |
| ビルド出力 | `dist/cli.js`、`dist/commands/` |

既存 generator:
- `src/core/generator.ts` — Playwright (TypeScript) 用
- `src/core/generator-swift.ts` — XCTest (Swift) 用（既に複数 target の萌芽あり）

---

## 2. oclif Flags でカスタム enum (target) を追加する方法

### 推奨: `Flags.option()` を使う

`@oclif/core` v4 では `Flags.option()` が enum-like な文字列制約に最適。

```typescript
import { Command, Flags } from '@oclif/core';

const TARGET_OPTIONS = ['playwright', 'xctest', 'jest'] as const;
type Target = typeof TARGET_OPTIONS[number];

export default class Generate extends Command {
  static flags = {
    target: Flags.option({
      options: TARGET_OPTIONS as unknown as string[],
      char: 't',
      description: 'Test framework target to generate for',
      default: 'playwright',
    })(),
    // ...既存 flags
  };
}
```

**制約:**
- `Flags.option()` の `options` は `string[]` 型を要求するため、`as unknown as string[]` キャストが必要
- `flags.target` の型は `string` になる（`Target` 型への絞り込みは実行時アサーションが必要）
- oclif v4 では `Flags.enum()` は存在しないため `Flags.option()` が正解

### 型安全な絞り込みパターン

```typescript
function assertTarget(value: string): asserts value is Target {
  if (!TARGET_OPTIONS.includes(value as Target)) {
    throw new Error(`Unknown target: ${value}`);
  }
}

// run() 内で
const rawTarget = flags.target ?? 'playwright';
assertTarget(rawTarget);
// ここから rawTarget は Target 型
```

---

## 3. tsup entry points への新ファイル追加要否

### 現状の tsup 設定

```typescript
entry: ['src/cli.ts', 'src/commands/*.ts'],
```

glob パターンで `src/commands/*.ts` を全取込み済み。

**generator ファイルを `src/core/` 以下に追加する場合 → entry 変更不要。**
`src/core/` は `src/commands/generate.ts` から import されるだけなので、tsup が依存として自動バンドルする。

**新 command ファイルを `src/commands/` に追加する場合 → 自動で entry に含まれる（glob のため）。**

**注意:** generator を独立した entry point（別ファイルとして外部公開）にしたい場合のみ entry への追加が必要。現状の設計では不要。

---

## 4. ESM only 環境での dynamic import の可否

### 結論: 技術的には可能だが、このプロジェクトでは不推奨

**可能な理由:**
- `"type": "module"` + Node 18 + `module: NodeNext` の組み合わせでは `import()` は完全にサポートされる
- `await import('./generator-xctest.js')` のような dynamic import は動作する

**不推奨な理由:**
- tsup の `entry: ['src/commands/*.ts']` と static import で十分なケースに dynamic import を使うと、tsup がバンドル境界を判断しにくくなる
- `moduleResolution: NodeNext` では dynamic import のパスに `.js` 拡張子が必須（ソースは `.ts` だが import は `.js`）
- 型安全性が低下する（返り値が `any` になりやすい）
- plugin パターンに dynamic import が必要なのは「実行時に外部パッケージをロードする」ケースのみ。tespec の generator は全て同一パッケージ内に存在するため不要

**推奨: static import + registry パターン（後述）**

---

## 5. TypeScript discriminated union / Record type で registry を型安全に表現する方法

### パターン A: Record<Target, GeneratorFn> による registry

```typescript
// src/core/generator-registry.ts

import type { Screen, Setup } from './schema.js';

export const TARGET_OPTIONS = ['playwright', 'xctest'] as const;
export type Target = typeof TARGET_OPTIONS[number];

export type GeneratorFn = (screen: Screen, setups: Setup[]) => string;

import { generateTestFile } from './generator.js';
import { generateSwiftTestFile } from './generator-swift.js';

export const GENERATOR_REGISTRY: Record<Target, GeneratorFn> = {
  playwright: generateTestFile,
  xctest: generateSwiftTestFile,
};
```

**メリット:**
- `Record<Target, GeneratorFn>` は Target の全 key を要求するため、新 target 追加時に registry への登録漏れをコンパイルエラーで検出できる
- dynamic import 不要、型安全

**デメリット:**
- 全 generator が常に bundle に含まれる（現状の規模では問題なし）

### パターン B: discriminated union による Generator interface

```typescript
type PlaywrightGenerator = { target: 'playwright'; ext: 'spec.ts'; generate: GeneratorFn };
type XCTestGenerator = { target: 'xctest'; ext: 'swift'; generate: GeneratorFn };
type Generator = PlaywrightGenerator | XCTestGenerator;
```

**メリット:** 出力拡張子など target ごとのメタデータも型で表現できる
**デメリット:** Record パターンより記述量が多い

**推奨: パターン A（Record）をベースに、メタデータが必要になった時点でパターン B へ移行。**

---

## 6. oclif コマンドから generator を選択するための推奨パターン

### 推奨設計（generate.ts の変更最小化）

```typescript
// generate.ts の run() 内
const { flags } = await this.parse(Generate);
const target = (flags.target ?? 'playwright') as Target; // runtime check 推奨

const generator = GENERATOR_REGISTRY[target];
if (!generator) {
  this.error(`Unsupported target: ${target}`);
}

const outputs = selectedScreens.map((screen) => ({
  screenId: screen.screen,
  content: generator(screen, setups),
}));
```

**出力ファイル拡張子の問題:**
現在は `${output.screenId}.spec.ts` でハードコードされている。target ごとに拡張子が異なるため、registry にメタデータとして持たせるか、target ごとの `fileExt` を別途 Record で定義する。

```typescript
const FILE_EXT: Record<Target, string> = {
  playwright: 'spec.ts',
  xctest: 'swift',
};
```

---

## 7. 既存コードの観察から得た重要な知見

1. **`generator-swift.ts` が既に存在する** — multi-target の萌芽がある。ただし `generate.ts` からは一切呼ばれていない（未接続）。設計の核心は「この未接続 generator をどう接続するか」。

2. **`generator.ts` と `generator-swift.ts` は同じ `buildComments` / `renderCaseGroup` ロジックを重複して持つ** — 共通処理の抽出余地あり（ただしスコープ外なら触らない）。

3. **oclif の `"commands": "./dist/commands"` 設定** — `dist/commands/` 以下のファイルがコマンドとして自動登録される。サブコマンド（例: `generate playwright`）を作る場合は `src/commands/generate/` ディレクトリ構造も選択肢になる。

4. **`shims: true` in tsup** — `__dirname` / `__filename` shim が有効。ESM 環境での互換性は確保されている。

---

## 8. 制約まとめ・推奨方針

| 観点 | 制約 / 推奨 |
|------|------------|
| Flags | `Flags.option()` を使う。型は `string` で返るため runtime assertion が必要 |
| tsup entry | 変更不要（`src/core/` への追加は自動バンドル対象） |
| dynamic import | 不要・不推奨。static import + registry で十分 |
| registry 型 | `Record<Target, GeneratorFn>` が最もシンプルで安全 |
| 出力拡張子 | `Record<Target, string>` で別管理 |
| 未接続の generator-swift.ts | 設計の核心。registry 経由で接続するのが自然 |
