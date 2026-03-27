# Integration Testing パターン

コンポーネントテスト（jsdom）では検証できない「実際のシステム間連携」をテストするパターン集。
ファイル監視、サーバー起動、SSE 通信など、副作用を伴う処理のテストに使う。

## いつ統合テストを書くか

テスト対象が以下のいずれかに該当する場合、コンポーネントテストではなく統合テストを書く:

| テスト対象 | コンポーネントテスト | 統合テスト |
|-----------|-------------------|-----------|
| UI の表示・操作 | `render` + `fireEvent` | - |
| データ更新で UI が変わる | `rerender` で十分 | - |
| **ファイル変更 → 検知** | 不可能 | 実ファイルを書き換えて検証 |
| **サーバー → SSE → 更新** | モックが必要 | サーバー起動 + fetch |
| **パイプライン全体** | 不可能 | 全レイヤーを結合 |

## ファイル監視テスト（Watcher）

実際のファイルシステムに YAML を書き込み、watcher が検知するかを検証する。

### テンプレート

```typescript
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';

import { watchProject } from '../../src/<module>/watcher.js';

let cleanupDir: string | undefined;

afterEach(async () => {
  if (cleanupDir) {
    await rm(cleanupDir, { recursive: true, force: true });
    cleanupDir = undefined;
  }
});

async function createTempDir(): Promise<string> {
  const dir = join(tmpdir(), `test-watcher-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'initial.yaml'), 'key: value\n');
  cleanupDir = dir;
  return dir;
}
```

### パターン1: ファイル変更の検知

```typescript
it('ファイル変更 → onUpdate が呼ばれる', async () => {
  const dir = await createTempDir();
  let updateCount = 0;

  const handle = watchProject(
    { directories: [dir], debounceMs: 100 },
    () => { updateCount++; },
  );

  // chokidar の初期化を待つ（重要）
  await new Promise((r) => setTimeout(r, 500));

  // ファイルを変更
  await writeFile(join(dir, 'initial.yaml'), 'key: updated\n');

  // デバウンス + 検知を待つ
  await new Promise((r) => setTimeout(r, 800));

  expect(updateCount).toBeGreaterThanOrEqual(1);
  await handle.stop();
});
```

### パターン2: ファイル追加の検知

```typescript
it('新規ファイル追加 → onUpdate が呼ばれる', async () => {
  const dir = await createTempDir();
  let updateCount = 0;

  const handle = watchProject(
    { directories: [dir], debounceMs: 100 },
    () => { updateCount++; },
  );

  await new Promise((r) => setTimeout(r, 500));
  await writeFile(join(dir, 'new-file.yaml'), 'screen: new\n');
  await new Promise((r) => setTimeout(r, 800));

  expect(updateCount).toBeGreaterThanOrEqual(1);
  await handle.stop();
});
```

### パターン3: stop 後の無反応

```typescript
it('stop() 後は onUpdate が呼ばれない', async () => {
  const dir = await createTempDir();
  let updateCount = 0;

  const handle = watchProject(
    { directories: [dir], debounceMs: 100 },
    () => { updateCount++; },
  );

  await new Promise((r) => setTimeout(r, 500));
  await handle.stop();

  await writeFile(join(dir, 'initial.yaml'), 'key: after-stop\n');
  await new Promise((r) => setTimeout(r, 800));

  expect(updateCount).toBe(0);
});
```

### 注意点

- **初期化待ち**: chokidar は非同期で初期化されるため、`await new Promise(r => setTimeout(r, 500))` で待つ
- **デバウンス待ち**: `debounceMs` + マージン分を待つ。100ms デバウンスなら 800ms 程度待つ
- **一時ディレクトリ**: `tmpdir()` + タイムスタンプでユニークなディレクトリを作成。`afterEach` で必ず削除
- **テスト速度**: ファイル監視テストは遅い（1テスト 1-2秒）。数を絞る

## サーバー + API テスト

実際にサーバーを起動して HTTP リクエストを送るテスト。

### パターン: データ更新の反映

```typescript
import { startServer } from '../../src/<module>/server.js';

it('updateData 後に API が新しいデータを返す', async () => {
  const server = await startServer(initialData, { port: 0 });
  try {
    // 初期データを確認
    const res1 = await fetch(`${server.url}/api/specs`);
    const data1 = await res1.json();
    expect(data1.screens).toHaveLength(2);

    // データを更新
    server.updateData(emptyData);

    // 更新後のデータを確認
    const res2 = await fetch(`${server.url}/api/specs`);
    const data2 = await res2.json();
    expect(data2.screens).toHaveLength(0);
  } finally {
    await server.stop();
  }
});
```

## パイプライン統合テスト

ファイル変更 → watcher → server.updateData → API レスポンス更新の全パイプラインをテスト。

```typescript
it('YAML 変更 → API レスポンスが更新される', async () => {
  const dir = await createTempDir();
  const project = await parseProject(configPath);
  const server = await startServer(project.result!, { port: 0 });

  const watcher = watchProject(
    { directories: [dir], debounceMs: 100 },
    async () => {
      const updated = await parseProject(configPath);
      if (updated.result) server.updateData(updated.result);
    },
  );

  try {
    await new Promise((r) => setTimeout(r, 500));

    // YAML を変更
    await writeFile(join(dir, 'new-screen.yaml'), '...');
    await new Promise((r) => setTimeout(r, 1000));

    // API で更新を確認
    const res = await fetch(`${server.url}/api/specs`);
    const data = await res.json();
    // 新しいデータが反映されていることを検証
  } finally {
    await watcher.stop();
    await server.stop();
  }
});
```

## テストの分離方針

```
tests/<feature>/
├── <screen>.test.ts          # Component: @testing-library + jsdom
├── <screen>-api.test.ts      # API: サーバー起動 + fetch（必要なら）
├── <feature>-watcher.test.ts # Integration: 実ファイル変更検知
└── helpers.ts
```

- **Component テスト**: 速い。大量に書いてよい
- **API テスト**: 中速。ルートごとに数件
- **Watcher テスト**: 遅い。変更検知・追加検知・stop 後の3パターン程度に絞る
