import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkImplemented, countUnimplemented } from '../impl-checker.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(
    tmpdir(),
    `tespec-impl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- checkImplemented ---

describe('checkImplemented', () => {
  it('全テストが実装済みのディレクトリをチェックすると、全エントリの level が ok で hasUnimplemented が false', async () => {
    await writeFile(
      path.join(tempDir, 'login.spec.ts'),
      `
test("a", () => { expect(true).toBe(true); });
test("b", () => { expect(true).toBe(true); });
`,
    );

    const result = await checkImplemented(tempDir);

    expect(result.hasUnimplemented).toBe(false);
    expect(result.issues.every((i) => i.level === 'ok')).toBe(true);
  });

  it('TODO implement マーカーがあるファイルを検出すると、warn issue が含まれ未実装数がメッセージに含まれる', async () => {
    await writeFile(
      path.join(tempDir, 'login.spec.ts'),
      `
test("a", () => { expect(true).toBe(true); });
test("b", () => {
  // TODO: implement
});
`,
    );

    const result = await checkImplemented(tempDir);

    expect(result.hasUnimplemented).toBe(true);
    expect(result.issues.some((i) => i.level === 'warn')).toBe(true);
    const warnIssue = result.issues.find((i) => i.level === 'warn');
    expect(warnIssue!.message).toMatch(/1/);
  });

  it('it.todo() 呼び出しを検出する', async () => {
    await writeFile(
      path.join(tempDir, 'login.spec.ts'),
      `
it("a", () => { expect(true).toBe(true); });
it.todo("b");
`,
    );

    const result = await checkImplemented(tempDir);

    expect(result.hasUnimplemented).toBe(true);
    expect(result.issues.some((i) => i.level === 'warn')).toBe(true);
  });

  it('test.todo() 呼び出しを検出する', async () => {
    await writeFile(
      path.join(tempDir, 'login.spec.ts'),
      `
test("a", () => { expect(true).toBe(true); });
test.todo("b");
`,
    );

    const result = await checkImplemented(tempDir);

    expect(result.hasUnimplemented).toBe(true);
  });

  it('it.skip() 呼び出しを検出する', async () => {
    await writeFile(
      path.join(tempDir, 'login.spec.ts'),
      `
it("a", () => { expect(true).toBe(true); });
it.skip("b", () => {});
`,
    );

    const result = await checkImplemented(tempDir);

    expect(result.hasUnimplemented).toBe(true);
  });

  it('test.skip() 呼び出しを検出する', async () => {
    await writeFile(
      path.join(tempDir, 'login.spec.ts'),
      `
test("a", () => { expect(true).toBe(true); });
test.skip("b", () => {});
`,
    );

    const result = await checkImplemented(tempDir);

    expect(result.hasUnimplemented).toBe(true);
  });

  it('テストディレクトリが存在しない場合、エラーが返る', async () => {
    const result = await checkImplemented(path.join(tempDir, 'nonexistent'));

    expect(result.hasUnimplemented).toBe(true);
    expect(result.issues.some((i) => i.level === 'warn')).toBe(true);
  });

  it('テストディレクトリが空の場合、issues が空配列で hasUnimplemented が false', async () => {
    const emptyDir = path.join(tempDir, 'empty');
    await mkdir(emptyDir, { recursive: true });

    const result = await checkImplemented(emptyDir);

    expect(result.issues).toEqual([]);
    expect(result.hasUnimplemented).toBe(false);
  });

  it('テストファイル内のテストが 0 件の場合、total が 0 で implemented も 0', async () => {
    await writeFile(path.join(tempDir, 'empty.spec.ts'), '// no tests here\n');

    const result = await checkImplemented(tempDir);

    // ファイルは存在するがテストが 0 件なので ok
    const issue = result.issues.find((i) => i.file.includes('empty'));
    if (issue) {
      expect(issue.total).toBe(0);
      expect(issue.implemented).toBe(0);
    }
    expect(result.hasUnimplemented).toBe(false);
  });
});

// --- countUnimplemented ---

describe('countUnimplemented', () => {
  it('TODO マーカーなしのファイルを解析すると、total がテスト数と一致し unimplemented が 0', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(
      filePath,
      `
test("a", () => { expect(1).toBe(1); });
test("b", () => { expect(2).toBe(2); });
`,
    );

    const result = await countUnimplemented(filePath);

    expect(result.total).toBe(2);
    expect(result.unimplemented).toBe(0);
  });

  it('TODO implement コメントが含まれるファイルを解析すると、TODO マーカーの数だけ unimplemented がカウントされる', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(
      filePath,
      `
test("a", () => { expect(1).toBe(1); });
test("b", () => {
  // TODO: implement
});
test("c", () => {
  // TODO: implement
});
`,
    );

    const result = await countUnimplemented(filePath);

    expect(result.total).toBe(3);
    expect(result.unimplemented).toBe(2);
  });

  it('it.todo() と通常の it() が混在するファイルを解析すると、total が合計で unimplemented が it.todo() の数', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(
      filePath,
      `
it("a", () => { expect(1).toBe(1); });
it("b", () => { expect(2).toBe(2); });
it.todo("c");
`,
    );

    const result = await countUnimplemented(filePath);

    expect(result.total).toBe(3);
    expect(result.unimplemented).toBe(1);
  });

  it('空のファイルを解析すると total が 0 で unimplemented が 0', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(filePath, '');

    const result = await countUnimplemented(filePath);

    expect(result.total).toBe(0);
    expect(result.unimplemented).toBe(0);
  });
});
