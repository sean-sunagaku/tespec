## 実装計画

### チーム調査・議論で判明した事項

#### 既存構造の概要

- `src/commands/` — oclif コマンドクラスのみ配置。`generate.ts` / `validate.ts` の 2 コマンドが存在
- `src/core/` — ビジネスロジック層。`parser.ts`, `schema.ts`, `validator.ts`, `unit-validator.ts`, `generators/`, `viewer/` を含む
- `src/core/viewer/watcher.ts` — chokidar v4 ラッパーがすでに実装済み。`WatcherOptions` / `WatchHandle` インターフェースと `watchProject()` 関数が存在
- `src/core/parser.ts` — `parseProject(configPath): Promise<{ result?: ParsedProject; errors: ParseError[] }>` が公開 API
- `src/core/schema.ts` — `ParsedProject` を構成する型（`Screen`, `Setup`, `UnitSpec`, `Config`）を Zod で定義
- `src/utils/output.ts` — `printError` / `printSuccess` / `printWarning` / `printOk` でコンソール出力統一
- テストは `tests/integration/` に vitest + oclif `runCommand` ユーティリティで統合テスト

#### 依存関係と影響範囲

- `hono`, `@hono/node-server`, `chokidar@^4` はすでに `package.json` の `dependencies` に追加済み
- `tsup.config.ts` の `entry: ['src/cli.ts', 'src/commands/*.ts']` glob により、`commands/view.ts` は**エントリー追加不要**で自動マッチ
- `src/core/viewer/watcher.ts` はすでに実装済み — 新規作成不要
- 既存の `generate.ts` / `validate.ts` / `parser.ts` / `schema.ts` への変更はゼロ
- `viewer/server.ts` と `viewer/template.ts` の 2 ファイルと `commands/view.ts` の追加のみで完結

#### コードベースの慣例・パターン

- コマンドは `export default class Xxx extends Command` 形式、`static summary` と `static flags` を持つ
- `flags.config` で config.yaml パスを指定、`resolveConfigPath()` で `path.resolve` する慣例
- パース失敗時は `this.exit(1)` で終了（oclif の慣例）
- 依存の方向: `commands → core → schema`（一方向のみ）
- `tsup.config.ts` は変更不要、`shims: true` により ESM でも `__dirname` 相当が使用可能

#### リスク・注意点

- `watcher.ts` の `WatcherOptions.directories` は配列形式 — view.ts 側で `screensDir`, `setupsDir`, `unitsDir` を配列にまとめて渡す必要がある
- `parseProject` の戻り値は `{ result?: ParsedProject; errors: ParseError[] }` — `result` が undefined のケース（パースエラー時）は graceful に処理する
- SSE クライアントのリーク防止: サーバー停止時に全 SSE ストリームを閉じる必要がある
- SIGINT ハンドラは `process.once('SIGINT', ...)` で登録し、`server.stop()` と `watcher.stop()` を両方 await する
- Preact / HTM は CDN (`https://esm.sh/preact`, `https://esm.sh/htm/preact`) から読み込む — ネットワーク不要の要件がある場合は要確認

---

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `/Users/babashunsuke/Repository/tespec/src/core/viewer/components/App.tsx` | 新規作成。ルーター + 状態管理 + SSE 購読 |
| `/Users/babashunsuke/Repository/tespec/src/core/viewer/components/Dashboard.tsx` | 新規作成。一覧 + カバレッジダッシュボード |
| `/Users/babashunsuke/Repository/tespec/src/core/viewer/components/ScreenDetail.tsx` | 新規作成。screen 詳細（cases タイプ別表示） |
| `/Users/babashunsuke/Repository/tespec/src/core/viewer/components/UnitDetail.tsx` | 新規作成。unit 詳細（methods + cases） |
| `/Users/babashunsuke/Repository/tespec/src/core/viewer/components/SetupDetail.tsx` | 新規作成。setup 詳細（steps + 参照元） |
| `/Users/babashunsuke/Repository/tespec/src/core/viewer/template.ts` | 新規作成。HTML シェル（`<div id="root">` + バンドル JS + Tailwind CDN） |
| `/Users/babashunsuke/Repository/tespec/src/core/viewer/server.ts` | 新規作成。`startServer(options): Promise<ServerHandle>`（Hono + SSE） |
| `/Users/babashunsuke/Repository/tespec/src/commands/view.ts` | 新規作成。`View extends Command`（オーケストレーター） |

※ `src/core/viewer/watcher.ts` はすでに実装済みのため変更なし

### 技術スタック（確定）

| 要素 | 採用 | 備考 |
|------|------|------|
| HTTP Server | Hono + @hono/node-server | SSE は `hono/streaming` の `streamSSE` |
| File Watch | chokidar v4 | watcher.ts 実装済み |
| Frontend Framework | Preact（CDN） | コンポーネントは .tsx で分離、tsup でバンドル |
| CSS | **Tailwind CSS（CDN）** | `<script src="https://cdn.tailwindcss.com">` で読み込み。ビルド不要 |
| テスト | @testing-library/preact + vitest + jsdom | コンポーネントテストは `// @vitest-environment jsdom` |

### CSS 方針: Tailwind CSS

- **CDN 読み込み**: template.ts の HTML シェルに `<script src="https://cdn.tailwindcss.com">` を含める
- **ビルドステップ不要**: PostCSS/autoprefixer の設定は不要。CDN 版で十分
- **クラス命名規則**: Tailwind ユーティリティクラスのみ使用。カスタム CSS は書かない
- **テストへの影響**: jsdom は CSS を解釈しないため、Tailwind クラスの有無はテストしない。DOM 構造とテキスト内容で検証する
- **ダークモード**: 将来対応可能（`dark:` プレフィックス）。Phase 1 では対応しない
- **レスポンシブ**: `sm:` / `md:` / `lg:` プレフィックスでレスポンシブ対応

**コンポーネントでの使用例:**
```tsx
function CaseBadge({ type }: { type: string }) {
  const colors = {
    normal: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    boundary: 'bg-yellow-100 text-yellow-800',
  };
  return <span class={`px-2 py-0.5 rounded text-xs font-medium ${colors[type]}`}>{type}</span>;
}

---

### 実装ステップ（順序付き）

1. **`template.ts` を実装する（純粋関数、副作用なし）**
   - 対象: `/Users/babashunsuke/Repository/tespec/src/core/viewer/template.ts`
   - 挿入位置: 新規ファイル
   - 実装内容:
     - `import type { ParsedProject } from '../parser.js'` で型のみインポート
     - `export function renderHtml(project: ParsedProject): string` を実装
     - HTML テンプレートリテラルで Preact + HTM を CDN 読み込み
     - `/api/specs` を fetch して Preact コンポーネントで描画するクライアント JS をインライン埋め込み
     - `/events` の SSE を EventSource で購読し、変更時に再 fetch + 再描画するクライアント JS をインライン埋め込み
     - screens / setups / units のカバレッジ（件数）を表示するコンポーネントを含める

2. **`server.ts` を実装する（Hono + SSE）**
   - 対象: `/Users/babashunsuke/Repository/tespec/src/core/viewer/server.ts`
   - 挿入位置: 新規ファイル
   - 実装内容:
     - `import { Hono } from 'hono'` と `import { serve } from '@hono/node-server'`
     - `import type { ParsedProject } from '../parser.js'`
     - `export interface ServerOptions { port: number }`
     - `export interface ServerHandle { updateData(project: ParsedProject): void; stop(): Promise<void>; readonly url: string }`
     - `export async function startServer(initialData: ParsedProject, options: ServerOptions): Promise<ServerHandle>`
     - `GET /` — `renderHtml(currentData)` を返す
     - `GET /api/specs` — JSON レスポンス（screens / setups / units）
     - `GET /events` — SSE ストリーム。接続ごとに controller を配列で管理
     - `updateData()` で `currentData` を更新し、全 SSE クライアントに `update` イベントを送信
     - `stop()` で全 SSE ストリームを閉じてから `@hono/node-server` の close を await

3. **`view.ts` コマンドを実装する（オーケストレーター）**
   - 対象: `/Users/babashunsuke/Repository/tespec/src/commands/view.ts`
   - 挿入位置: 新規ファイル
   - 実装内容:
     - `export default class View extends Command`
     - `static summary = 'Serve tespec YAML specs in a local browser'`
     - `static flags = { config: Flags.string({ char: 'c' }), port: Flags.integer({ default: 3737 }) }`
     - オーケストレーションフロー:
       1. `resolveConfigPath(flags.config)` でパスを解決
       2. `parseProject(configPath)` を await — エラー時は `printError` して `this.exit(1)`
       3. `startServer(parsed.result, { port: flags.port })` を await
       4. `this.log(`Serving at ${server.url}`)` で URL 表示
       5. `watchProject({ directories: [screensDir, setupsDir, ...unitsDir] }, async () => { ... })` で監視開始
          - コールバック内: `parseProject()` → `server.updateData()` → パースエラーは `printWarning` のみ（サーバー継続）
       6. `process.once('SIGINT', async () => { await Promise.all([server.stop(), watcher.stop()]) })` で終了ハンドラ登録
     - `screensDir` / `setupsDir` / `unitsDir` は `parsed.result.config` から `path.resolve` して求める

---

### テスト計画

#### `template.ts` — 単体テスト

- ファイル: `tests/unit/viewer/template.test.ts`（新規作成）
- フィクスチャ: `ParsedProject` のモックオブジェクト（screens / setups / units を含む最小データ）を直接構築
- 検証項目:
  - `renderHtml()` が文字列を返す
  - 返値に `<html>` / `</html>` が含まれる
  - screens / setups / units の件数が HTML に含まれる
  - `EventSource` に関連する JS コードが含まれる（SSE 購読）
  - `/api/specs` fetch コードが含まれる

#### `server.ts` — 単体テスト（`hono/testing` を使用）

- ファイル: `tests/unit/viewer/server.test.ts`（新規作成）
- `hono/testing` の `app.request()` を使ってポートバインドなしでテスト
- 検証項目:
  - `GET /` が 200 と HTML を返す
  - `GET /api/specs` が 200 と JSON を返す（screens / setups / units のキーを含む）
  - `updateData()` 後に `GET /api/specs` が更新されたデータを返す
  - `GET /events` がSSEストリームを返す（Content-Type: `text/event-stream`）

#### 統合テスト — `view` コマンド

- ファイル: `tests/integration/view.test.ts`（新規作成）
- oclif の `runCommand` ユーティリティを使用
- 検証項目:
  - `--dry-run` 相当（サーバーを起動せず即終了する `--no-watch` フラグ、または短時間タイムアウト）での動作確認
  - 存在しない config パスを渡したとき exit 1 になること
  - 起動後に `Serving at http://localhost:3737` が stdout に含まれること

---

### リスク・注意点

1. **SSE ストリームのリーク**
   `stop()` 内で全 SSE コントローラーに `close()` を呼ぶことを必ず実装する。未クローズのストリームが残るとプロセス終了が遅延する。

2. **SIGINT の二重登録**
   `process.once` を使い、一度だけハンドラが呼ばれるようにする。`process.on` は使わない。

3. **パース中の YAML エラー（ウォッチ後）**
   ウォッチのコールバック内でパースに失敗した場合、`server.updateData()` を呼ばず、`printWarning` でエラーを出力してサーバーを継続させる。

4. **`unitsDir` が未設定の場合**
   `config.units_dir` はオプショナル。`watchProject` に渡す `directories` 配列に `undefined` を含めないようにフィルタリングする。

5. **ポート競合**
   `@hono/node-server` の `serve()` がポートバインド失敗時に throw するため、`startServer()` の呼び出し元でエラーをキャッチして `printError` + `this.exit(1)` する。

---

### 検討した代替案

| 案 | 棄却理由 |
|---|---------|
| `node:http` + SSE（依存ゼロ） | ルート追加時に `if (req.url === ...)` が肥大化。`hono/testing` が使えないためテスト容易性が低い |
| WebSocket (`ws` ライブラリ) | サーバー→クライアントの一方向通知のみ必要。双方向は不要。`ws` の追加依存が無駄 |
| Vite + React | Vite の dev サーバーは CLI 組み込みが困難。フロントエンドビルドが tsup とは別軸で必要になり、oclif lifecycle 管理が複雑 |
| Preact + HTM をバンドルに含める | CLI パッケージサイズが増加。CDN 読み込みで十分（ブラウザ専用、ビルド不要） |
| `data-transformer.ts` を追加 | `template.ts` が `ParsedProject` を直接受け取れば不要。不要な中間層は作らない |
| `view.ts` 1ファイル完結（watcher/server をインライン） | chokidar + SSE 管理を合わせると 200 行超になり可読性が落ちる。テスト単位の分離もできない |
