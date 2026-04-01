# vitest テスト実装の注意点

tespec-s04-imp で vitest テストを書く際のハマりポイントと対策。

## 環境設定

### jsdom 環境の指定

コンポーネントテストには jsdom が必要。2つの方法がある:

**方法1: テストファイル冒頭のコメント（推奨）**
```typescript
// @vitest-environment jsdom
import { render, screen } from '@testing-library/preact';
```
ファイル単位で指定できるので、API テスト（Node 環境）とコンポーネントテスト（jsdom 環境）を分離できる。

**方法2: vitest.config.ts でグローバル指定**
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```
全テストが jsdom になるので、API テスト（fetch, サーバー起動）と衝突する可能性がある。
テストファイル冒頭のコメントで個別指定する方が安全。

### jsdom と Node テストの共存

1つの feature ディレクトリに両方が混在する場合:
```
tests/viewer/
├── viewer-dashboard.test.ts    ← // @vitest-environment jsdom
├── viewer-api.test.ts          ← Node 環境のまま（サーバー起動 + fetch）
└── helpers.ts
```

## ESM + TypeScript の注意点

### import パスの .js 拡張子

tespec は ESM（`"type": "module"`）のため、TypeScript の import でも `.js` 拡張子が必要:

```typescript
// OK
import { renderHtml } from '../../src/core/viewer/template.js';

// NG（ESM では解決できない）
import { renderHtml } from '../../src/core/viewer/template';
```

ただし vitest は TypeScript のパス解決を自前でやるため、拡張子なしでも動くことがある。
プロジェクトの慣例に合わせること。

### TSX ファイルの import

Preact コンポーネント (.tsx) を vitest でテストする場合:
```typescript
// vitest は .tsx を自動で解決する（esbuild で変換）
import { App } from '../../src/core/viewer/components/App';
```

vitest.config.ts に JSX 設定が必要な場合:
```typescript
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
});
```

## テスト分離のパターン

### サーバーテストのポート競合

複数のテストファイルが同時にサーバーを起動するとポート競合する:

```typescript
// port: 0 でランダムポート割り当て（必須）
const server = await startServer(project, { port: 0 });
```

### テスト間のグローバル状態汚染

jsdom 環境では `document.body` がテスト間で共有される場合がある:

```typescript
import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup(); // DOM をリセット
});
```

## 非同期テスト

### async/await の使い分け

```typescript
// コンポーネントテスト（同期でOK）
it('表示確認', () => {
  render(<App data={data} />);
  expect(screen.getByText('title')).toBeInTheDocument();
});

// サーバーテスト（非同期が必要）
it('API テスト', async () => {
  const server = await startServer(data, { port: 0 });
  // ...
});
```

### waitFor で状態更新を待つ

非同期で DOM が更新される場合:
```typescript
import { waitFor } from '@testing-library/preact';

it('データ読み込み後に表示される', async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText('loaded')).toBeInTheDocument();
  });
});
```

## テストデータの設計

### 最小限のフィクスチャ

tespec YAML の全フィールドを再現する必要はない。テストに必要なフィールドだけ:

```typescript
// Good: テストに必要な最小限
const screen: Screen = {
  screen: 'login',
  route: '/login',
  title: 'ログイン画面',
  cases: [
    { action: '開く', steps: ['アクセス'], expect: '表示', type: 'normal' },
  ],
};

// Bad: 全フィールドを無理に埋める
const screen: Screen = {
  screen: 'login',
  route: '/login',
  title: 'ログイン画面',
  cases: [
    {
      action: '開く',
      steps: ['use:logged_in', '/login にアクセスする'],
      expect: ['フォーム表示', 'ナビ表示'],
      type: 'normal',
      given: 'logged_in',
      target: 'login-form',
      not_expect: ['エラー'],
      navigates_to: 'home',
    },
  ],
};
```

### 複数テストで共有するフィクスチャ

`helpers.ts` に集約し、各テストが `createTestProject()` 等で取得する:

```typescript
// helpers.ts
export function createTestProject(): ParsedProject { ... }
export function createEmptyProject(): ParsedProject { ... }
export function createScreenWithAllTypes(): Screen { ... }
```

## よくあるエラーと対処

| エラー | 原因 | 対処 |
|--------|------|------|
| `Cannot find module` | 実装ファイル未作成 | Phase 3（RED）なら正常。Phase 4 で作成 |
| `ReferenceError: document is not defined` | jsdom 環境未指定 | `// @vitest-environment jsdom` を追加 |
| `TypeError: render is not a function` | import パスの問題 | `@testing-library/preact` から import |
| `EADDRINUSE` | ポート競合 | `port: 0` を使う |
| `fetch is not defined` | Node 18 未満 | Node 18+ なら `fetch` は組み込み |
