import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';

import { watchProject } from '../../src/core/viewer/watcher.js';

let cleanupDir: string | undefined;

afterEach(async () => {
  if (cleanupDir) {
    await rm(cleanupDir, { recursive: true, force: true });
    cleanupDir = undefined;
  }
});

async function createTempYamlDir(): Promise<string> {
  const dir = join(tmpdir(), `tespec-watcher-test-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'login.yaml'),
    'screen: login\nroute: /login\ntitle: Login\ncases: []\n',
  );
  cleanupDir = dir;
  return dir;
}

describe('Viewer Watcher', () => {
  it('YAML ファイルを変更する → onUpdate が呼ばれる', async () => {
    const dir = await createTempYamlDir();
    let updateCount = 0;

    const handle = watchProject(
      { directories: [dir], debounceMs: 100 },
      () => { updateCount++; },
    );

    // chokidar の初期化を待つ
    await new Promise((r) => setTimeout(r, 500));

    // YAML ファイルを変更
    await writeFile(
      join(dir, 'login.yaml'),
      'screen: login\nroute: /login\ntitle: Updated Login\ncases: []\n',
    );

    // デバウンス + chokidar 検知を待つ
    await new Promise((r) => setTimeout(r, 800));

    expect(updateCount).toBeGreaterThanOrEqual(1);

    await handle.stop();
  });

  it('新しい YAML ファイルを追加する → onUpdate が呼ばれる', async () => {
    const dir = await createTempYamlDir();
    let updateCount = 0;

    const handle = watchProject(
      { directories: [dir], debounceMs: 100 },
      () => { updateCount++; },
    );

    await new Promise((r) => setTimeout(r, 500));

    // 新しいファイルを追加
    await writeFile(
      join(dir, 'home.yaml'),
      'screen: home\nroute: /\ntitle: Home\ncases: []\n',
    );

    await new Promise((r) => setTimeout(r, 800));

    expect(updateCount).toBeGreaterThanOrEqual(1);

    await handle.stop();
  });

  it('stop() 後は onUpdate が呼ばれない', async () => {
    const dir = await createTempYamlDir();
    let updateCount = 0;

    const handle = watchProject(
      { directories: [dir], debounceMs: 100 },
      () => { updateCount++; },
    );

    await new Promise((r) => setTimeout(r, 1000));
    await handle.stop();
    // stop 完了を確実に待つ
    await new Promise((r) => setTimeout(r, 200));

    const countBeforeWrite = updateCount;

    // stop 後にファイル変更
    await writeFile(
      join(dir, 'login.yaml'),
      'screen: login\nroute: /login\ntitle: After Stop\ncases: []\n',
    );

    await new Promise((r) => setTimeout(r, 1000));

    expect(updateCount).toBe(countBeforeWrite);
  });
});
