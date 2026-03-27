# Step 2: アーキテクチャパターン比較 — tespec view

## 設計テーマ
tespec YAML 仕様をローカルサーバーで HTML 表示 + ホットリロード

## 方針
- 拡張性重視（検索・フィルタ・エクスポート等の将来追加を見越す）
- 依存ライブラリは必要なら追加OK
- ホットリロード必須（YAML 変更時にブラウザ自動更新）

## コンテキスト分析

### プロジェクト制約
- **ESM only** (package.json に `"type": "module"`)
- **Node.js 18+** — `fetch`, `ReadableStream`, `EventSource` 相当が組み込み
- **oclif** ベースのコマンド実装
- **tsup** でバンドル
- **既存依存**: `@oclif/core`, `yaml`, `zod`, `picocolors`（最小限）
- **parseProject()** — screens/setups/units を一括パース済み API が存在

### ホットリロード方式の選択肢
| 方式 | 仕組み | 双方向性 | Node.js 18 対応 |
|------|--------|----------|----------------|
| SSE (Server-Sent Events) | HTTP/1.1 ストリーム | サーバー→クライアント一方向 | ネイティブ対応 |
| WebSocket | 全二重 TCP | 双方向 | ws ライブラリ必要 |
| Long Polling | HTTP ロングポーリング | 擬似双方向 | ネイティブ対応 |
| Vite HMR | Vite 内蔵 HMR | 双方向+モジュール粒度 | Vite 追加必要 |
| Short Polling | 定期 fetch | クライアント→サーバー | ネイティブ対応 |

---

## パターン候補一覧（12案）

| # | パターン | HTTP Server | File Watch | Hot Reload | Frontend |
|---|---------|-------------|------------|------------|----------|
| 1 | Minimal node:http + SSE | node:http | node:fs.watch | SSE | Vanilla JS |
| 2 | Hono + SSE + Vanilla JS | Hono + @hono/node-server | chokidar | SSE | Vanilla JS |
| 3 | Express + WebSocket | Express | chokidar | WebSocket (ws) | Vanilla JS |
| 4 | Vite Dev Server + React | Vite | Vite HMR | Vite HMR | React |
| 5 | Hono + HTMX + SSE | Hono + @hono/node-server | chokidar | SSE + hx-sse | HTMX |
| 6 | Fastify + SSE | Fastify | chokidar | SSE | Vanilla JS |
| 7 | Hono + Preact/Signals | Hono + @hono/node-server | chokidar | SSE | Preact |
| 8 | Koa + WebSocket | Koa + koa-websocket | chokidar | WebSocket | Vanilla JS |
| 9 | node:http + Long Polling | node:http | node:fs.watch | Long Polling | Vanilla JS |
| 10 | node:http + Short Polling | node:http | node:fs.watch | 2秒間隔 fetch | Vanilla JS |
| 11 | Express + SSE + HTMX | Express | chokidar | SSE + hx-sse | HTMX |
| 12 | Hono + SSE + Svelte | Hono + @hono/node-server | chokidar | SSE | Svelte (compiled) |

---

## 多軸スコアリング（1-5 点、高いほど良い）

### 凡例
- **保守性**: コードの読みやすさ、将来の変更容易性
- **テスト容易性**: HTTP ルート・watcher・テンプレートの単体テスト可能性
- **拡張性**: 検索/フィルタ/エクスポート等の機能追加への対応
- **スタック適合性**: 現プロジェクト（ESM/TS/oclif）との親和性 ← platform-expert 担当
- **シンプルさ**: YAGNI 原則・依存最小・実装コスト ← devils-advocate 担当

| 軸 | 重み | ① node:http+SSE | ② Hono+SSE+VanillaJS | ③ Express+WS | ④ Vite+React | ⑤ Hono+HTMX | ⑥ Fastify+SSE | ⑦ Hono+Preact | ⑧ Koa+WS | ⑨ LongPoll | ⑩ ShortPoll | ⑪ Express+HTMX | ⑫ Hono+Svelte |
|----|------|-----------------|---------------------|-------------|-------------|------------|--------------|-------------|----------|-----------|------------|---------------|------------|
| **保守性** | 高 | 2 | 4 | 3 | 4 | 4 | 4 | 4 | 3 | 2 | 2 | 3 | 4 |
| **テスト容易性** | 高 | 3 | 5 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 3 |
| **拡張性** | 高 | 2 | 5 | 4 | 5 | 4 | 4 | 5 | 3 | 2 | 2 | 4 | 5 |
| **スタック適合性** | 中 | **5** | **5** | **3** | **2** | **5** | **3** | **4** | **3** | **5** | **5** | **3** | **3** |
| **シンプルさ** | 中 | **5** | **3** | **1** | **1** | **2** | **1** | **1** | **1** | **4** | **5** | **2** | **1** |

### architecture-lead 担当スコア（保守性・テスト容易性・拡張性）詳細根拠

#### 保守性
- **① node:http+SSE: 2** — HTTP サーバーをゼロから書くと routing/middleware が肥大化しやすい
- **② Hono+SSE+VanillaJS: 4** — Hono の宣言的ルーティング + TS-first で変更しやすい
- **③ Express+WS: 3** — Express は成熟しているが WS の lifecycle 管理がやや複雑
- **④ Vite+React: 4** — React コンポーネントは保守性高いが、Vite 設定が別軸で複雑
- **⑤ Hono+HTMX: 4** — サーバー主導 UI は変更箇所が少ない
- **⑥ Fastify+SSE: 4** — Fastify のスキーマ駆動は保守性高い、ただし学習コスト
- **⑦ Hono+Preact: 4** — コンポーネントで整理できる
- **⑧ Koa+WS: 3** — Koa は middleware が単純だが WS の複雑さあり
- **⑨ LongPoll: 2** — タイムアウト・再接続の複雑な状態管理
- **⑩ ShortPoll: 2** — シンプルに見えるが不必要な poll サイクルと UX 遅延
- **⑪ Express+HTMX: 3** — Express + HTMX は組み合わせとして安定するが WS ほど複雑ではない
- **⑫ Hono+Svelte: 4** — Svelte のコンパイル出力はランタイムなしで保守しやすい

#### テスト容易性
- **① node:http+SSE: 3** — 独自 Router をテストするのが手間
- **② Hono+SSE+VanillaJS: 5** — `hono/testing` の `app.request()` でルート単体テスト可能、watcher も EventEmitter で分離しやすい
- **③ Express+WS: 4** — `supertest` で HTTP はテストしやすい、WS は別途 ws テストクライアント必要
- **④ Vite+React: 3** — React コンポーネントは testing-library でテスト可能だが、Vite サーバー自体のテストは難
- **⑤ Hono+HTMX: 4** — サーバーサイドのみテストすればよい（クライアント JS が少ない）
- **⑥ Fastify+SSE: 4** — `fastify.inject()` でルート単体テスト可能
- **⑦ Hono+Preact: 4** — Hono テスト + Preact コンポーネントテストが独立
- **⑧ Koa+WS: 3** — supertest 対応だが WS は別途必要
- **⑨ LongPoll: 3** — タイムアウトを含むテストが複雑
- **⑩ ShortPoll: 4** — シンプルな GET エンドポイントのテストのみ
- **⑪ Express+HTMX: 3** — supertest でOK、HTMX は E2E で確認が必要
- **⑫ Hono+Svelte: 3** — Svelte のコンパイルビルドが必要でテスト環境が複雑になる

#### 拡張性
- **① node:http+SSE: 2** — ルート追加のたびに if 分岐が増える
- **② Hono+SSE+VanillaJS: 5** — `app.get('/api/search', ...)` 追加だけ。middleware chain でも整理可能
- **③ Express+WS: 4** — Express の Router 分割で整理できる
- **④ Vite+React: 5** — React コンポーネントの追加が容易、ただし Vite 設定への依存
- **⑤ Hono+HTMX: 4** — サーバーエンドポイント + HTMX ターゲット追加で機能拡張
- **⑥ Fastify+SSE: 4** — プラグインシステムで機能分割できる
- **⑦ Hono+Preact: 5** — Preact コンポーネントで UI 拡張しやすい
- **⑧ Koa+WS: 3** — Koa middleware は整理できるが WS 管理が拡張時のボトルネック
- **⑨ LongPoll: 2** — 拡張するたびにポーリング管理が複雑化
- **⑩ ShortPoll: 2** — 拡張よりもまずリアルタイム性の問題を解決する必要
- **⑪ Express+HTMX: 4** — Router + HTMX ターゲット追加
- **⑫ Hono+Svelte: 5** — Svelte コンポーネント + Hono ルートの両輪で拡張

---

## 総合評価（architecture-lead 視点のみ、保守性+テスト容易性+拡張性の加重合計）

重み: 保守性=3, テスト容易性=3, 拡張性=4（拡張性重視という方針から）

| # | パターン | 保守性×3 | テスト×3 | 拡張性×4 | 小計（/50） |
|---|---------|---------|---------|---------|------------|
| 1 | node:http+SSE | 6 | 9 | 8 | 23 |
| **2** | **Hono+SSE+VanillaJS** | **12** | **15** | **20** | **47** |
| 3 | Express+WS | 9 | 12 | 16 | 37 |
| 4 | Vite+React | 12 | 9 | 20 | 41 |
| 5 | Hono+HTMX | 12 | 12 | 16 | 40 |
| 6 | Fastify+SSE | 12 | 12 | 16 | 40 |
| **7** | **Hono+Preact** | **12** | **12** | **20** | **44** |
| 8 | Koa+WS | 9 | 9 | 12 | 30 |
| 9 | LongPoll | 6 | 9 | 8 | 23 |
| 10 | ShortPoll | 6 | 12 | 8 | 26 |
| 11 | Express+HTMX | 9 | 9 | 16 | 34 |
| 12 | Hono+Svelte | 12 | 9 | 20 | 41 |

### architecture-lead 観点のトップ3
1. **② Hono+SSE+VanillaJS** (47/50) — テスト容易性が最高、拡張も容易
2. **⑦ Hono+Preact** (44/50) — UIコンポーネントで将来の拡張余地大
3. **④ Vite+React** / **⑫ Hono+Svelte** (41/50) — 拡張性高いがビルド複雑

---

## 統合スコアリング（全エージェント評価完了・確定版）

重み: 保守性=3, テスト容易性=3, 拡張性=4, スタック適合性=3, シンプルさ=2（最大スコア=75）

devils-advocate シンプルさ確定スコア: ①5, ②3, ③2, ④1, ⑤2, ⑥1, ⑦2, ⑧1, ⑨4, ⑩5, ⑪2, ⑫1

| 順位 | # | パターン | arch(/50) | スタック×3(/15) | シンプルさ×2(/10) | **総合(/75)** |
|------|---|---------|-----------|--------------|----------------|--------------|
| **1** | **2** | **Hono+SSE+VanillaJS** | **47** | **15** | **6** | **68** |
| **2** | **7** | **Hono+Preact** | **44** | **12** | **4** | **60** |
| **3** | **5** | **Hono+HTMX** | **40** | **15** | **4** | **59** |
| 4 | 6 | Fastify+SSE | 40 | 9 | 2 | 51 |
| 5 | 10 | ShortPoll | 26 | 15 | 10 | 51 |
| 6 | 12 | Hono+Svelte | 41 | 9 | 2 | 52 |
| 7 | 3 | Express+WS | 37 | 9 | 4 | 50 |
| 8 | 4 | Vite+React | 41 | 6 | 2 | 49 |
| 9 | 1 | node:http+SSE | 23 | 15 | 10 | 48 |
| 10 | 11 | Express+HTMX | 34 | 9 | 4 | 47 |
| 11 | 9 | LongPoll | 23 | 15 | 8 | 46 |
| 12 | 8 | Koa+WS | 30 | 9 | 2 | 41 |

### 総合トップ3（確定）
1. **② Hono+SSE+VanillaJS** (68/75) — 保守性・テスト・拡張・スタック全軸で最高バランス
2. **⑦ Hono+Preact** (60/75) — 拡張性最高、ただしフロント JS 増加
3. **⑤ Hono+HTMX** (59/75) — スタック適合性高く、クライアント JS 最小

---

## devils-advocate「1ファイル完結案」への architecture-lead 応答

devils-advocate の主張: node:http + SSE を view.ts 1ファイル・200行以内・依存追加ゼロで完結させる

### 受け入れる点
- フロントエンドフレームワーク（React/Preact/Svelte）は不要 → **Vanilla JS テンプレートリテラルに変更**
- 現状3ルートなら1ファイルスタートで十分 → **最初は viewer/ 分割しない**

### Hono を維持する理由
1. **テスト容易性が決定的**: `hono/testing` の `app.request()` で vitest から直接 HTTP ルートをテストできる。node:http の生サーバーではテストのためにポートをバインドする必要がある
2. **ルート増加時の保守性**: `if (req.url === ...)` が4〜5本を超えると可読性が急落。Hono なら `app.get('/api/search', handler)` 追加だけ
3. **重さは誤解**: hono + @hono/node-server の追加は ~40KB。「依存ゼロ」との差はほぼ影響なし

### 採用する折衷案
**② Hono + SSE + Vanilla JS テンプレートリテラル、最初は view.ts 1ファイル**
- `src/commands/view.ts` に Hono app・SSE・watcher・HTML テンプレートをまとめる
- 200行超えたら `src/core/viewer/` に分割（既存コマンドパターンと同じ判断軸）
- フロントエンドビルドは一切なし

### devils-advocate 担当スコア（シンプルさ）詳細根拠

評価基準: YAGNI 原則・依存追加数・ビルド複雑さ・既存コマンド設計（1コマンド≒1ファイル150〜200行）との一致度

- **① node:http+SSE: 5** — 依存ゼロ。ルート3本なら 50 行のルーター関数で完結。既存コマンドの設計パターンと一致
- **② Hono+SSE+VanillaJS: 3** — Hono + @hono/node-server の 2 依存追加。viewer/ ディレクトリ分割は現時点では過剰だが、フレームワーク自体は小さい
- **③ Express+WS: 1** — Express + ws の 2 依存追加。WS は一方向通知に対してオーバースペック
- **④ Vite+React: 1** — Vite + React + バンドル設定追加。CLI パッケージへの HTML インライン化が困難。最も複雑
- **⑤ Hono+HTMX: 2** — Hono の依存追加。HTMX は CDN のみだが、hx-sse 拡張の理解コストがある
- **⑥ Fastify+SSE: 1** — Fastify はプラグイン設計前提の重いフレームワーク。3 ルートには完全にオーバースペック
- **⑦ Hono+Preact: 1** — Hono + Preact の依存追加。JSX 変換設定が必要でビルド複雑化
- **⑧ Koa+WS: 1** — Koa + koa-websocket + ws の複数依存追加。WS は不要
- **⑨ LongPoll: 4** — 依存ゼロだが、タイムアウト・再接続の状態管理が SSE より複雑
- **⑩ ShortPoll: 5** — 依存ゼロ。実装最小。ただし 2 秒ポーリングの UX 問題は別途考慮が必要
- **⑪ Express+HTMX: 2** — Express 依存追加 + HTMX CDN。Express の初期設定コストがある
- **⑫ Hono+Svelte: 1** — Hono + Svelte コンパイラの依存追加。Svelte のビルドが tsup とは完全に別軸で必要

### platform-expert 担当スコア（スタック適合性）詳細根拠

評価基準: ESM only / NodeNext moduleResolution / tsup ESM バンドル / Node.js 18+ / oclif との相性

- **① node:http+SSE: 5** — コアモジュールのみ。追加依存ゼロ、tsup の external 扱いで自動除外、ESM 完全対応
- **② Hono+SSE+VanillaJS: 5** — Hono は Web Standards ベース ESM-first。@hono/node-server も tsup ESM ビルド実績あり。static import のみで dynamic import 問題なし
- **③ Express+WS: 3** — Express 5 は Node 18+ 対応になったが、CJS 寄り設計の歴史があり型定義の ESM 対応が不完全なケースが残る。ws も追加依存
- **④ Vite+React: 2** — Vite は dev サーバー全体を管理する設計で CLI ツールへの組み込みが困難。フロントエンドビルドが tsup とは別軸で必要になり、oclif コマンドからの lifecycle 管理も複雑
- **⑤ Hono+HTMX: 5** — Hono は ESM-first（②と同様）。HTMX は CDN 読み込みのみでフロントビルド不要。追加依存は Hono のみ
- **⑥ Fastify+SSE: 3** — Fastify 本体は ESM 対応済みだが、プラグインエコシステムが CJS 混在。tsup バンドル時に dynamic import が問題になる可能性あり
- **⑦ Hono+Preact: 4** — Hono は完全適合（②と同様）。Preact は CDN 読み込みなら問題なし。バンドルに含める場合は JSX 変換設定が tsup に追加で必要
- **⑧ Koa+WS: 3** — Koa は ESM 対応しているが型定義・middleware エコシステムの ESM 整備が遅い。koa-websocket は CJS のみの可能性あり
- **⑨ LongPoll: 5** — node:http のみ（①と同様）。追加依存ゼロ
- **⑩ ShortPoll: 5** — node:http のみ（①と同様）。追加依存ゼロ
- **⑪ Express+HTMX: 3** — Express の ESM 罠は③と同様。HTMX は CDN なので問題なし、ただし Express 起因で3点
- **⑫ Hono+Svelte: 3** — Hono は完全適合だが、Svelte のコンパイルビルドが tsup とは完全に別軸で必要。svelte compiler を tsup pipeline に統合するか別途 vite を入れるかになり、ビルド設定が大幅に複雑化

---

## architecture-lead 推薦理由（② Hono+SSE+VanillaJS）

### モジュール構成案（全エージェント議論を経た最終確定）

**確定: 4ファイル構成（`data-transformer.ts` なし）**

決定ロジック:
1. chokidar v4 採用は全エージェント合意（engines >= 18 で Node 18 + macOS の fs.watch 信頼性問題）
2. chokidar v4 + デバウンス + エラーハンドリング ≈ 20行 → view.ts インラインは過大
3. → `watcher.ts` を独立ファイル化（module-designer の実装量の論拠）
4. `data-transformer.ts` は削除（devils-advocate + module-designer 双方が不要と合意）
5. `template.ts` は `ParsedProject` を直接受け取る

```
src/
├── commands/
│   └── view.ts                      # 薄いオーケストレーター（SIGINT + 起動順制御）
└── core/
    └── viewer/
        ├── template.ts              # renderHtml(project: ParsedProject): string（純粋関数）
        ├── watcher.ts               # watchProject() + chokidar v4 + デバウンス
        └── server.ts                # startServer() → ServerHandle（Hono + SSE）
```

### 各モジュールの公開インターフェース（確定）

```typescript
// template.ts
export function renderHtml(project: ParsedProject): string;

// watcher.ts
export function watchProject(
  options: { configPath: string; debounceMs?: number },
  onUpdate: () => void,
): { stop(): void };

// server.ts
export function startServer(
  options: { port: number; project: ParsedProject },
): Promise<{ updateData(project: ParsedProject): void; stop(): Promise<void>; url: string }>;
```

### commands/view.ts のオーケストレーションフロー

```
1. parseProject(configPath) → ParsedProject
2. startServer({ port, project }) → ServerHandle
3. watchProject({ configPath }, () => {
     parseProject(configPath) → project
     server.updateData(project)
   }) → WatchHandle
4. SIGINT → server.stop() + watcher.stop()
```

### 技術的根拠
1. **Hono の `hono/testing`** で `app.request()` を使った HTTP ルートの単体テストが可能 → vitest と相性◎
2. **SSE** は HTTP ストリームのみ。ws ライブラリ不要で Node.js 18+ のネイティブ `ReadableStream` に乗れる
3. **Vanilla JS テンプレートリテラル** — フロントエンドビルド不要。tsup でビルドすれば動く
4. **拡張時**: `/api/search?q=` エンドポイント追加 → `app.get('/api/search', ...)` 1行で完結
5. **依存グラフ**: viewer → core/parser → core/schema の一方向のみ。循環依存なし（dependency-analyst 確認済み）
6. **テスタビリティ**: template.ts（純粋関数）、watcher.ts（chokidar ラッパー分離）、server.ts（hono/testing）がそれぞれ単独でテスト可能

### tsup バンドル影響（dependency-analyst + platform-expert 分析より）

現在の tsup.config.ts（確認済み）:
```ts
entry: ['src/cli.ts', 'src/commands/*.ts'],
format: ['esm'], target: 'node18', shims: true
// external 未指定 = すべてバンドル
```

- `src/commands/view.ts` は glob `commands/*.ts` に自動マッチ → **エントリー追加不要**
- `hono` / `@hono/node-server` はバンドル可能（~14KB、external 指定不要）
- `chokidar v4` は ESM 対応済み → **external 指定不要でバンドル可能**（dependency-analyst の「external 必要」を訂正）
- `node:http` 等の Node built-in は tsup が自動的に external 扱い
- `shims: true` により `__dirname` / `__filename` が ESM でも利用可能（サーバー起動時のパス解決に有用）

**tsup.config.ts の変更: 不要**（依存追加のみで設定変更なし）

### chokidar バージョン指定（platform-expert より）
- **chokidar v5 は Node.js 20+ 必須** → engines `node >= 18` と不一致
- **chokidar v4 を指定**: `"chokidar": "^4"` — ESM-first、依存数 13→1 に削減済み

### node:fs.watch を使わない理由（platform-expert 技術調査）

Node.js 公式ドキュメント: "Expect null filenames, coalesced/duplicated events, and rename-vs-change ambiguity"

- macOS で `filename` が null で返るケースあり（Node 18 / 20 共通）
- VS Code のデフォルト atomic write（tmpファイル → rename）でイベントが届かない
- Node.js 18 での信頼性保証が困難（engines 宣言との矛盾）

`node:fs.watch` で信頼性を確保しようとすると 45〜65行のボイラープレートが必要。chokidar v4 では watchProject 実装が約10行で済む。

### watcher.ts の実装参考（platform-expert より）

```typescript
import { watch } from 'chokidar';

export function watchProject(dir: string, onUpdate: () => void): { stop(): void } {
  const watcher = watch(dir, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 100 } });
  let timer: ReturnType<typeof setTimeout> | undefined;
  watcher.on('all', () => {
    clearTimeout(timer);
    timer = setTimeout(onUpdate, 300);
  });
  watcher.on('error', (err) => console.error('[tespec] watcher error:', err));
  return { stop: () => watcher.close() };
}
```

### 追加依存（確定）
- `hono` (TypeScript-first, ESM-first, Web Standards ベース)
- `@hono/node-server` (Node.js http.Server アダプター、ESM ビルド実績あり)
- `chokidar@^4` (信頼性の高いファイル監視、macOS FSEvents 対応、Node.js 18+ 互換)
