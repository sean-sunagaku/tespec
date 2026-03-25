# Platform Expert フィードバック: TypeScript/Node.js CLI ツール分析

**作成者**: platform-expert
**日付**: 2026-03-24
**対象**: tespec CLI ツール (TypeScript/Node.js)

---

## 1. 推奨ライブラリ選定

### 1.1 CLI フレームワーク: commander

**推奨: commander**

| 選択肢 | 週次DL | 評価 |
|--------|--------|------|
| commander | ~500M | 最多実績・安定 |
| yargs | ~200M | 高機能だが重い |
| citty | 少 | 新興・実績不足 |

**理由:**
- tespec のコマンド構成は `status / validate / sync / generate / diagram` の 5 つ。サブコマンド数が限定的で commander の object-oriented なコマンドツリーと相性が良い
- yargs は chainable API が強力だが middleware・設定項目が多く、シンプル最優先方針に反する
- citty は UnJS エコシステム向け。OSS として広範なユーザーへの安定提供を考えると現時点では採用リスクあり

```typescript
// commander の基本パターン
import { Command } from 'commander';
const program = new Command();
program
  .command('validate')
  .description('YAML の参照整合性をチェック')
  .action(validateCommand);
```

### 1.2 YAML パーサー: yaml (eemeli/yaml)

**推奨: yaml (js-yaml ではなく)**

| 選択肢 | TypeScript型定義 | メンテ | 備考 |
|--------|-----------------|--------|------|
| yaml | 組み込み | 活発 | 推奨 |
| js-yaml | @types/js-yaml 別途必要 | 停滞気味 | 非推奨 |

**理由:**
- TypeScript の型定義が package 内蔵 (外部 `@types/*` 不要)
- parse エラーが詳細な位置情報付きで返される → YAML バリデーションのエラーメッセージ品質が向上
- `yaml.parse()` が返す型を Zod で絞り込むパターンと組み合わせやすい

```typescript
import { parse, ParseError } from 'yaml';
// エラー時はファイル内の行・列情報付きで例外
```

### 1.3 スキーマバリデーション: zod

**推奨: zod**

| 選択肢 | TypeScript型推論 | 開発体験 | 用途 |
|--------|-----------------|----------|------|
| zod | ネイティブ | 高 | CLI・設定ファイル向き |
| ajv | 要追加設定 | 中 | 高頻度API向き |

**理由:**
- tespec のコアバリュー「バリデーションの信頼性」を実現するのに最適
- `z.infer<typeof ScreenSchema>` で TypeScript 型と Zod スキーマが単一の定義源になる → 型とバリデーションの乖離が起きない
- CLI ツールは高頻度バリデーション（1000回/秒）を行わないため、ajv のパフォーマンス優位は不要
- エラーメッセージが人間可読 (`z.ZodError.issues`) → `tespec validate` の出力に直接利用できる

```typescript
const ScreenSchema = z.object({
  screen: z.string(),
  route: z.string(),
  title: z.string(),
  cases: z.array(CaseSchema).min(1, { message: "cases は1件以上必要" }),
});
type Screen = z.infer<typeof ScreenSchema>; // 型定義不要
```

**Zod v3 vs v4**: 2025年に Zod v4 がリリース。v4 はバンドルサイズ削減・パフォーマンス改善が目玉。新規プロジェクトは v4 を採用。

### 1.4 出力フォーマット: picocolors + cli-table3

**推奨: picocolors (chalk ではなく)**

| 選択肢 | バンドルサイズ | 読み込み速度 | 備考 |
|--------|--------------|-------------|------|
| picocolors | 7 kB | 0.47 ms | 推奨 |
| chalk v5 | 41 kB | 6.17 ms | 不要な機能多い |
| chalk v4 | 101 kB | - | CJS のみ |

**理由:**
- tespec が使う色: エラー=赤、警告=黄、成功=緑、強調=太字。picocolors で十分カバーできる
- chalk の追加機能（256色、TrueColor、Chainable API）は不要
- 起動速度が重要な CLI では読み込みコスト削減が体験に直結

**cli-table3**: `tespec status` のテーブル表示に必要。軽量で TypeScript 対応。

```typescript
import pc from 'picocolors';
import Table from 'cli-table3';
console.log(pc.red('ERROR:'), 'home.yaml: given "logged_in" → setup が見つからない');
```

---

## 2. ビルドツール: tsup

**推奨: tsup**

**理由:**
- esbuild ベースで高速
- `--format cjs,esm` で dual output が簡単
- 設定ファイルがシンプル（`tsup.config.ts` 数行）
- Node.js CLI の bin エントリーポイント生成に実績あり
- `--dts` フラグで型定義ファイルも生成

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  shims: true, // ESM/CJS 互換 shim
});
```

---

## 3. npm パッケージとしての配布設計

### 3.1 package.json の重要フィールド

```json
{
  "name": "tespec",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "tespec": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "engines": {
    "node": ">=18"
  },
  "files": ["dist"]
}
```

### 3.2 ESM/CJS 対応戦略

**2025年現在の状況:**
- Node.js v22/v23 で CJS から ESM を require できる機能が安定化
- ただし、ユーザー環境の多様性を考えると dual publishing が安全

**CLI ツールとしての bin エントリーの注意点:**
- bin に指定するファイルの先頭に `#!/usr/bin/env node` シェバンが必須
- tsup の `banner` オプション または `shims: true` で自動付与
- ファイルのパーミッションが実行可能 (`chmod +x`) になっているか確認 (tsup が自動処理)

### 3.3 Node.js バージョンサポート

**推奨: Node.js >=18**

- Node.js 18 は 2025年4月に EOL (LTS サポート終了) → `>=20` でも良いが、互換性を優先するなら `>=18`
- `npx tespec` での利用は npx がインストールされている Node.js 環境に依存

---

## 4. このスタックの設計上の制約

### 4.1 ファイルシステム操作の同期 vs 非同期

**制約**: YAML ファイルの読み込みは `fs.readFileSync` (同期) で十分だが、Glob でファイル一覧を取得する場合は非同期 API (`fs.promises.glob` or `fast-glob`) との整合性を設計段階で決める必要がある。

**推奨**: バリデーション処理全体を `async/await` で統一。起動時の一括読み込みパターン。

### 4.2 エラーハンドリング設計

**制約**: `process.exit(1)` を直接呼ぶとテストが困難になる。

**推奨パターン**: 例外をコマンド関数の境界まで伝搬させ、トップレベルの `main()` でまとめて `process.exit` を呼ぶ。

```typescript
// cli.ts (トップレベル)
main().catch((err) => {
  console.error(pc.red(err.message));
  process.exit(1);
});
```

### 4.3 設定ファイル探索

**制約**: `tespec` は `config.yaml` のパスをどこから探すか設計が必要。

**Node.js CLI の慣習**:
1. カレントディレクトリから上位に向かって探索 (`cosmiconfig` パターン)
2. `--config` フラグで明示指定
3. デフォルト: `./docs/tespec/config.yaml`

**推奨**: シンプル最優先なので固定パス (`./docs/tespec/config.yaml`) + `--config` フラグで上書き可能にする。cosmiconfig は複雑すぎる。

### 4.4 Glob パターンによるファイル探索

**推奨**: `fast-glob` または Node.js 22+ の `fs.glob` (実験的)。現時点では `fast-glob` が安定。

---

## 5. 推奨パターン（Node.js CLI の慣習）

### 5.1 コマンド構成

```
src/
├── cli.ts          # エントリーポイント (commander セットアップ)
├── commands/       # 各コマンドの実装
│   ├── validate.ts
│   ├── status.ts
│   ├── sync.ts
│   ├── generate.ts
│   └── diagram.ts
├── core/           # ビジネスロジック (コマンドから独立)
│   ├── loader.ts   # YAML 読み込み
│   ├── validator.ts # 参照整合性チェック
│   └── schema.ts   # Zod スキーマ定義
└── utils/
    └── output.ts   # テーブル・色付き出力
```

### 5.2 Zod スキーマの単一定義源パターン

```typescript
// core/schema.ts
export const CaseSchema = z.object({ ... });
export const ScreenSchema = z.object({ ... });
export type Case = z.infer<typeof CaseSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
// → TypeScript 型と YAML バリデーションが常に同期
```

### 5.3 テスト戦略

**CLI ツールのテストパターン:**
- `core/` 層: ユニットテスト (Vitest)
- `commands/` 層: stdout をキャプチャした統合テスト
- YAML バリデーション: fixtures YAML ファイルを用いたテスト

**推奨テストランナー: Vitest** (ESM ネイティブ、高速、vitest の型チェックで Zod スキーマのテストも書きやすい)

---

## 6. 避けるべきパターン

### 6.1 コマンド内でのビジネスロジック直書き

```typescript
// NG: コマンド関数に YAML 解析ロジックを直接書く
program.command('validate').action(async () => {
  const raw = fs.readFileSync('screens/home.yaml', 'utf-8');
  const data = parse(raw);
  // ... 全ロジックここに
});
```

**理由**: テストが困難になる。`core/` に分離することで単体テスト可能になる。

### 6.2 `process.exit()` の乱用

**NG**: コアロジック内で `process.exit()` を直接呼ぶ。
**理由**: テスト時にプロセスが終了してテストランナーが死ぬ。例外で伝搬させてトップレベルで処理。

### 6.3 chalk v4 (CJS のみ) の使用

**NG**: chalk v4 は CJS のみ。ESM ファースト設計と衝突する。
**代替**: picocolors (ESM/CJS 両対応)。

### 6.4 over-engineering な設定ファイル探索

**NG**: cosmiconfig などの複雑な設定探索ライブラリを導入。
**理由**: YAGNI。設定ファイルパスは固定 + `--config` で十分。

### 6.5 グローバルな状態管理

**NG**: モジュールレベルでの mutable state (config のシングルトンパターンを多用するなど)。
**理由**: テスト間で状態が汚染される。関数の引数として設定を渡すパターンを推奨。

---

## 7. まとめ: 最終推奨スタック

| 用途 | 推奨 | 理由 |
|------|------|------|
| CLI フレームワーク | **commander** | 安定・実績・シンプル |
| YAML パーサー | **yaml** | 型定義内蔵・詳細エラー |
| スキーマバリデーション | **zod v4** | TypeScript 型推論・人間可読エラー |
| ターミナル色付け | **picocolors** | 軽量・高速 |
| テーブル表示 | **cli-table3** | 軽量・TypeScript 対応 |
| ビルド | **tsup** | ESM/CJS dual・設定シンプル |
| テスト | **Vitest** | ESM ネイティブ・高速 |

**Node.js バージョン要件**: `>=18` (推奨 `>=20`)
**モジュール形式**: ESM ファースト + CJS dual publishing
**配布**: `bin` フィールドで `tespec` コマンドを公開。`npx tespec` で即利用可能。

---

## 8. architecture-lead へのメモ

- **参照整合性チェック**（`given` → setup, `navigates_to` → screen）は Zod の `.superRefine()` または `.transform()` ではなく、**Zod でスキーマバリデーション後に別関数で参照チェック**する設計を推奨。Zod はシングルファイルの構造検証に使い、クロスファイルの整合性は専用のバリデーター関数に分離する方が責務が明確。
- **PlantUML 生成**はライブラリ依存なし。文字列テンプレートで十分。
- **`.status.json` の読み書き**は `fs.promises` で直接。外部ライブラリ不要。
- 将来の `tespec generate` (Playwright スケルトン生成) では **Prettier** の `format()` API を使えば生成コードを整形できる（将来拡張時の選択肢として記録）。
