# API Testing パターン

HTTP サーバーのエンドポイントテストの実装パターン集。

## Hono + hono/testing

### テスト例: ルートの応答確認

```typescript
import { app } from '../../src/viewer/server';

it('GET / が HTML を返す', async () => {
  const res = await app.request('/');
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/html');
});

it('GET /api/specs が JSON を返す', async () => {
  const res = await app.request('/api/specs');
  const data = await res.json();
  expect(data.screens).toBeDefined();
  expect(data.setups).toBeDefined();
});
```

### サーバー起動 + fetch 方式

hono/testing が使えない場合（SSE テスト等）は実際にサーバーを起動する:

```typescript
import { startServer } from '../../src/viewer/server';

it('API がデータを返す', async () => {
  const server = await startServer(project, { port: 0 });
  try {
    const res = await fetch(`${server.url}/api/specs`);
    const data = await res.json();
    expect(data.screens).toHaveLength(2);
  } finally {
    await server.stop();
  }
});
```

### 注意点

- **port: 0**: OS がランダムポートを割り当てる。テスト間の競合を防ぐ
- **finally で stop()**: テスト失敗時もサーバーを確実に停止する
- **updateData のテスト**: データ更新後に API が新しいデータを返すか検証する

```typescript
it('updateData 後に新しいデータが返る', async () => {
  const server = await startServer(project, { port: 0 });
  try {
    server.updateData(emptyProject);
    const res = await fetch(`${server.url}/api/specs`);
    const data = await res.json();
    expect(data.screens).toHaveLength(0);
  } finally {
    await server.stop();
  }
});
```

## Express

```typescript
import request from 'supertest';
import { app } from '../../src/server';

it('GET /api/data', async () => {
  const res = await request(app).get('/api/data');
  expect(res.status).toBe(200);
  expect(res.body.items).toBeDefined();
});
```
