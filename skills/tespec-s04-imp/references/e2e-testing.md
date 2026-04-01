# E2E テスト（モックなし・ローカル専用）

Phase 8 で作成する、外部サービスを実際に呼ぶ E2E テストの具体的な書き方。

## 目次

1. [ディレクトリ構成](#ディレクトリ構成)
2. [vitest 設定](#vitest-設定)
3. [CLI 直接呼び出しテスト](#cli-直接呼び出しテスト)
4. [API Route 経由テスト](#api-route-経由テスト)
5. [プロンプトの書き方](#プロンプトの書き方)
6. [タイムアウト設定](#タイムアウト設定)
7. [YAML との対応](#yaml-との対応)

---

## ディレクトリ構成

```
docs/tespec/e2e/              tests/e2e/
├── chat-flow.yaml       →   ├── chat-flow.e2e.test.ts
└── api-routes.yaml      →   └── api-routes.e2e.test.ts
```

- ファイル名は `*.e2e.test.ts` パターン
- YAML とテストファイルは 1:1 対応
- YAML の `method` → テストの `describe`、`cases` → `it`

---

## vitest 設定

### CI 用（E2E 除外）

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
```

### E2E 専用（ローカルのみ）

```typescript
// vitest.e2e.config.ts
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.test.ts'],
    testTimeout: 180000,  // API Route 経由に合わせて 180秒
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### package.json

```json
{
  "test": "vitest run",
  "test:e2e": "vitest run --config vitest.e2e.config.ts"
}
```

---

## CLI 直接呼び出しテスト

外部サービスのクライアントモジュールを直接呼ぶテスト。
モックなしで「呼び出しインターフェースが実際に動くか」を検証する。

```typescript
/**
 * E2E テスト: 実際の Claude CLI を呼び出す
 * CI では実行しない。ローカルで `npm run test:e2e` で実行。
 */
import { describe, it, expect } from "vitest";
import { callClaude } from "@/lib/ai/claude-client";
import { parseCanvasOutput } from "@/lib/ai/canvas-action-parser";
import { buildNodes, buildEdges } from "@/lib/canvas/node-builder";

describe("チャットフロー E2E（実 Claude CLI 呼び出し）", () => {
  // 1. クライアントの基本呼び出し
  describe("callClaude", () => {
    it("単純な質問を送信する → 空でない応答が返る", async () => {
      const response = await callClaude("1+1は？答えだけ返して");

      expect(response.result).toBeTruthy();
      expect(response.result.length).toBeGreaterThan(0);
      expect(response.isError).toBe(false);
    }, 30000);

    it("systemPrompt付きで呼び出す → 指示に沿った応答が返る", async () => {
      const response = await callClaude(
        "こんにちは",
        "あなたは必ず「にゃん」で文を終えるアシスタントです。短く返答してください。"
      );

      expect(response.result).toBeTruthy();
      expect(response.result).toContain("にゃん");
    }, 30000);
  });

  // 2. クライアント → パーサー → ビルダーの結合
  describe("chat-to-canvas", () => {
    it("JSON ブロックを含む応答を得てパースする", async () => {
      const response = await callClaude(
        "ログイン画面を1つだけ設計して。以下のJSON形式で返して:\n" +
        '```json\n{"screens":[{"id":"...","label":"...","requirements":["..."]}],"transitions":[]}\n```',
        "UIモック設計アシスタント。必ず指定されたJSON形式で返答すること。余計な説明は不要。"
      );

      const parsed = parseCanvasOutput(response.result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.screens.length).toBeGreaterThanOrEqual(1);
        expect(parsed.data.screens[0].id).toBeTruthy();
      }
    }, 60000);

    it("パース結果から React Flow ノードを構築する", async () => {
      const response = await callClaude(
        "ホーム画面と設定画面の2つを設計して。以下のJSON形式で返して:\n" +
        '```json\n{"screens":[{"id":"home","label":"ホーム","requirements":["表示"]},{"id":"settings","label":"設定","requirements":["切替"]}],"transitions":[{"from":"home","to":"settings"}]}\n```',
        "上記のJSONをそのまま返してください。余計な説明は不要。"
      );

      const parsed = parseCanvasOutput(response.result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const nodes = buildNodes(parsed.data.screens);
        const edges = buildEdges(parsed.data.transitions);

        expect(nodes.length).toBeGreaterThanOrEqual(1);
        expect(nodes[0].data.label).toBeTruthy();
        expect(edges.length).toBeGreaterThanOrEqual(0);
      }
    }, 60000);
  });
});
```

---

## API Route 経由テスト

dev サーバーが起動している前提で、HTTP リクエストで API Route を呼ぶテスト。
サーバー処理 + 外部サービス呼び出しの結合を検証する。

```typescript
/**
 * E2E テスト: Route Handler を実サーバーで呼び出す
 * dev サーバーが localhost:3000 で起動している前提。
 */
import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("API Route E2E（実サーバー呼び出し）", () => {
  // SSE ストリーミングエンドポイント
  describe("POST /api/chat", () => {
    it("SSE レスポンスを受信する", async () => {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "1+1は？答えだけ返して" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");

      const text = await res.text();
      expect(text).toContain('"done":true');
      expect(text).toContain('"fullText"');
    }, 60000);
  });

  // 非ストリーミングエンドポイント
  describe("POST /api/generate", () => {
    it("生成結果を受信する", async () => {
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // プロンプトは短く具体的に
        body: JSON.stringify({ message: "ログイン画面を1つだけ。短く返して" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.result).toBeTruthy();
    }, 180000);  // API Route 経由は 180秒
  });

  // バリデーションエラー（外部サービス不要なので速い）
  describe("POST /api/check", () => {
    it("不正な canvasContext で 400 エラーが返る", async () => {
      const res = await fetch(`${BASE_URL}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });
});
```

---

## プロンプトの書き方

E2E テストの目的は「呼び出しインターフェースが正しく動くか」の確認。AI 出力品質の評価ではない。

### 原則: 短く・具体的に・最小限

```typescript
// BAD: 漠然として長い → AI が考え込んでタイムアウト
"シンプルなTODOアプリの画面を設計して"

// GOOD: 短く具体的 → 最小限の応答で検証できる
"ログイン画面を1つだけ。短く返して"
```

### JSON 形式を要求する場合

期待する JSON の具体例をプロンプトに含め、systemPrompt で「そのまま返せ」と指示する:

```typescript
const response = await callClaude(
  '以下のJSON形式で返して:\n```json\n{"screens":[{"id":"login","label":"ログイン","requirements":["入力"]}],"transitions":[]}\n```',
  "指定されたJSON形式で返答すること。余計な説明は不要。"
);
```

### systemPrompt の活用

応答形式を強制したい場合は systemPrompt で明示する:

```typescript
// 特定の文字列を含むか検証する場合
await callClaude("こんにちは", "必ず「にゃん」で文を終えるアシスタントです。");

// JSON 形式を強制する場合
await callClaude("画面を設計して", "必ず指定されたJSON形式で返答すること。余計な説明は不要。");
```

---

## タイムアウト設定

### 操作別の推奨値

| 操作 | 推奨タイムアウト | 理由 |
|------|---------------|------|
| 単純な質問（CLI 直接） | 30秒 | 短い応答 |
| JSON 生成（CLI 直接） | 60秒 | 構造化された応答 |
| 分析タスク（CLI 直接） | 120秒 | 長い思考が必要 |
| API Route 経由 | 180秒 | サーバー処理 + CLI 起動 + AI 応答の合計 |

API Route 経由はサーバー処理と CLI のスポーンオーバーヘッドが加わるため、CLI 直接より長くなる。120s では足りないことが多い。

### vitest での指定方法

```typescript
// グローバル設定（vitest.e2e.config.ts）
test: {
  testTimeout: 180000,
}

// 個別テストで上書き（末尾引数のみ使う）
it("単純な質問", async () => { ... }, 30000);
it("API Route 経由", async () => { ... }, 180000);
```

### 二重指定に注意

vitest の `it()` でタイムアウトを指定する方法は末尾引数のみ。`{ timeout }` オプションと末尾引数を同時に書くと片方が無視される:

```typescript
// BAD: 二重指定
it("テスト", { timeout: 120000 }, async () => { ... }, 60000);

// GOOD: 末尾引数のみ
it("テスト", async () => { ... }, 120000);
```

---

## YAML との対応

E2E 用 YAML は `docs/tespec/e2e/` に配置。テストファイルと 1:1 対応:

```yaml
# docs/tespec/e2e/chat-flow.yaml
unit: chat-flow-e2e
title: チャットフロー E2E（実 Claude CLI 直接呼び出し）
methods:
  - method: callClaude
    cases:
      - action: 単純な質問を送信する
        expect: 空でない応答が返る
        type: normal

      - action: systemPrompt付きで呼び出す
        expect: 指示に沿った応答が返る
        type: normal

  - method: chat-to-canvas
    cases:
      - action: JSON ブロックを含む応答を得る
        expect: parseCanvasOutput でパースが成功する
        type: normal
```

E2E 用 YAML は `config.yaml` の `units_dir` とは別管理（validate 対象外でもよい）。
