# tespec view コマンド — アーキテクチャ設計書

## 概要

tespec YAML 仕様（screens/setups/units）をローカル HTTP サーバーで HTML 表示し、
YAML 変更時にブラウザをホットリロードする `tespec view` コマンド。

## 技術スタック

| 要素 | 採用 | 理由 |
|------|------|------|
| HTTP Server | Hono + @hono/node-server | ESM 完全対応、宣言的ルーティング、hono/testing でテスト容易 |
| Hot Reload | SSE (Server-Sent Events) | 一方向通知で十分、追加依存ゼロ |
| File Watch | chokidar v4 | Node 18 + macOS での信頼性、VS Code atomic write 対応 |
| Frontend | Preact + HTM (CDN) | 将来の GUI 編集に備えたコンポーネントモデル、CLI パッケージに含まない |
| tsup 変更 | 不要 | chokidar v4 は pure JS、Hono は ESM-first |

## 追加依存

```json
{
  "hono": "^4",
  "@hono/node-server": "^1",
  "chokidar": "^4"
}
```

- chokidar は `^4` を明示（v5 は Node 20+ 必須のため）
- Preact/HTM はブラウザが CDN から取得（dependencies に含まない）

## モジュール構成

```
src/
├── commands/
│   └── view.ts                   # oclif Command（オーケストレーター）
└── core/
    └── viewer/
        ├── template.ts           # renderHtml(project: ParsedProject): string
        ├── watcher.ts            # watchProject() → WatchHandle
        └── server.ts             # startServer() → ServerHandle
```

## 依存グラフ

```
core/schema.ts（変更なし）
    ↓
core/parser.ts（変更なし）
    ↓
core/viewer/template.ts   ← import type { ParsedProject }
core/viewer/watcher.ts    ← chokidar@^4
core/viewer/server.ts     ← hono + @hono/node-server + template.ts
    ↓
commands/view.ts          ← parser + viewer/*
```

- 循環依存: なし
- 既存コードへの変更: ゼロ
- 安定層（schema/parser）への一方向依存

## 公開インターフェース

### core/viewer/template.ts

```typescript
import type { ParsedProject } from '../parser.js';

export function renderHtml(project: ParsedProject): string;
```

- 純粋関数（副作用なし）
- ParsedProject を直接受け取る（data-transformer 不要）
- Preact + HTM を CDN で読み込む HTML を生成
- SSE 接続の JS をインライン埋め込み

### core/viewer/watcher.ts

```typescript
export interface WatcherOptions {
  directories: string[];
  debounceMs?: number; // default: 300
}

export interface WatchHandle {
  stop(): Promise<void>;
}

export function watchProject(
  options: WatcherOptions,
  onUpdate: () => void,
): WatchHandle;
```

- chokidar v4 + デバウンス
- ディレクトリ再帰監視（screens/, setups/, units/）

### core/viewer/server.ts

```typescript
import type { ParsedProject } from '../parser.js';

export interface ServerOptions {
  port: number;
}

export interface ServerHandle {
  updateData(project: ParsedProject): void;
  stop(): Promise<void>;
  readonly url: string;
}

export function startServer(
  initialData: ParsedProject,
  options: ServerOptions,
): Promise<ServerHandle>;
```

- Hono app: GET `/`, GET `/api/specs`, GET `/events`
- SSE クライアント管理
- `updateData()` で全 SSE クライアントに通知

### commands/view.ts

```typescript
export default class View extends Command {
  static flags = {
    config: Flags.string({ char: 'c' }),
    port: Flags.integer({ default: 3737 }),
  };

  async run(): Promise<void> {
    // 1. parseProject() で初回パース
    // 2. startServer() でサーバー起動
    // 3. watchProject() で監視開始
    // 4. 変更時: parseProject() → server.updateData()
    // 5. SIGINT で server.stop() + watcher.stop()
  }
}
```

## API エンドポイント

| Method | Path | Response | 用途 |
|--------|------|----------|------|
| GET | `/` | HTML | メインページ（Preact アプリ） |
| GET | `/api/specs` | JSON | screens/setups/units データ |
| GET | `/events` | SSE stream | YAML 変更通知 |

## フロントエンド（ブラウザ側）

- Preact + HTM を CDN (`esm.sh`) から読み込み
- `/api/specs` から JSON を fetch して Preact コンポーネントで描画
- `/events` の SSE を EventSource で購読し、変更時に再 fetch + 再描画
- 将来: フォーム入力で YAML 編集 → POST API 追加

## ADR: 主要な設計判断

### ADR-1: Hono over node:http

- **状況**: 3 ルートの HTTP サーバーが必要
- **決定**: Hono を採用
- **根拠**: hono/testing でルート単体テスト可能、拡張時のルート追加が宣言的
- **棄却**: node:http（3ルートなら十分だが、テスト容易性と拡張性で劣る）

### ADR-2: chokidar over node:fs.watch

- **状況**: YAML ファイル変更の検知が必要
- **決定**: chokidar v4 を採用
- **根拠**: Node 18 + macOS + VS Code (atomic write) での信頼性。engines `>=18` の保証
- **棄却**: node:fs.watch（macOS で null filename、イベント漏れの既知問題）

### ADR-3: Preact+HTM over Vanilla JS

- **状況**: 将来 GUI 編集機能を追加予定
- **決定**: Preact + HTM を CDN 読み込みで採用
- **根拠**: コンポーネントモデル + Hooks で状態管理・フォーム処理。CDN なので CLI パッケージに影響なし
- **棄却**: Vanilla JS（閲覧専用なら十分だが、編集 UI でテンプレートリテラルは保守不能）

### ADR-4: SSE over WebSocket

- **状況**: ホットリロード通知が必要
- **決定**: SSE を採用
- **根拠**: サーバー→クライアントの一方向通知のみ必要。ブラウザ標準の自動再接続
- **棄却**: WebSocket（双方向不要、ws ライブラリの追加が不要）
