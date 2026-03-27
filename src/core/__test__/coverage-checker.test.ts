import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkCoverage, collectTestFiles, countTestCases } from '../coverage-checker.js';
import type { Screen, UnitSpec } from '../schema.js';

// --- helpers ---

function createScreen(overrides: Partial<Screen> = {}): Screen {
  return {
    screen: 'login',
    route: '/login',
    title: 'ログイン画面',
    cases: [
      {
        action: '画面を開く',
        steps: ['/login にアクセスする'],
        expect: 'フォームが表示される',
        type: 'normal',
      },
      {
        action: '誤った資格情報で送信する',
        steps: ['/login にアクセスする', '誤った認証情報を入力する'],
        expect: 'エラーが表示される',
        type: 'error',
      },
      {
        action: '長いメールアドレスを入力する',
        steps: ['/login にアクセスする', '256文字のメールアドレスを入力する'],
        expect: 'バリデーションエラーが表示される',
        type: 'boundary',
      },
    ],
    ...overrides,
  };
}

function createUnit(overrides: Partial<UnitSpec> = {}): UnitSpec {
  return {
    unit: 'user-service',
    title: 'ユーザーサービス',
    methods: [
      {
        method: 'getUser',
        cases: [
          { action: 'ユーザーを取得する', expect: 'ユーザー情報が返る', type: 'normal' },
          { action: '存在しないIDを指定する', expect: 'null が返る', type: 'error' },
        ],
      },
    ],
    ...overrides,
  };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(
    tmpdir(),
    `tespec-coverage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- checkCoverage ---

describe('checkCoverage', () => {
  it('全 screen に対応するテストファイルが存在する場合、全エントリが ok で hasErrors が false', async () => {
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'tests', 'login.spec.ts'),
      `
test("a", () => {});
test("b", () => {});
test("c", () => {});
`,
    );

    const result = await checkCoverage([createScreen()], [], path.join(tempDir, 'tests'));

    expect(result.hasErrors).toBe(false);
    expect(result.issues.every((i) => i.level === 'ok')).toBe(true);
  });

  it('全 unit に対応するテストファイルが存在する場合、unit エントリも ok で hasErrors が false', async () => {
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'tests', 'user-service.test.ts'),
      `
test("a", () => {});
test("b", () => {});
`,
    );

    const result = await checkCoverage([], [createUnit()], path.join(tempDir, 'tests'));

    expect(result.hasErrors).toBe(false);
    expect(result.issues.every((i) => i.level === 'ok')).toBe(true);
  });

  it('screen の case 数とテストファイル内の it()/test() 数が一致する場合、countMismatch なし', async () => {
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'tests', 'login.spec.ts'),
      `
test("a", () => {});
test("b", () => {});
test("c", () => {});
`,
    );

    const result = await checkCoverage([createScreen()], [], path.join(tempDir, 'tests'));

    expect(result.hasErrors).toBe(false);
    const loginIssue = result.issues.find((i) => i.specFile.includes('login'));
    expect(loginIssue).toBeDefined();
    expect(loginIssue!.level).toBe('ok');
  });

  it('.spec.ts と .test.ts の両方を検出できる', async () => {
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'tests', 'login.spec.ts'),
      `test("a", () => {});\ntest("b", () => {});\ntest("c", () => {});`,
    );
    await writeFile(
      path.join(tempDir, 'tests', 'home.test.ts'),
      `test("a", () => {});\ntest("b", () => {});`,
    );

    const homeScreen = createScreen({
      screen: 'home',
      route: '/',
      title: 'ホーム',
      cases: [
        { action: 'a', steps: ['s'], expect: 'e', type: 'normal' },
        { action: 'b', steps: ['s'], expect: 'e', type: 'error' },
      ],
    });

    const result = await checkCoverage(
      [createScreen(), homeScreen],
      [],
      path.join(tempDir, 'tests'),
    );

    expect(result.hasErrors).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((i) => i.level === 'ok')).toBe(true);
  });

  it('対応するテストファイルが存在しない screen がある場合、error issue が含まれ hasErrors が true', async () => {
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });
    // login のテストファイルは存在しない

    const result = await checkCoverage([createScreen()], [], path.join(tempDir, 'tests'));

    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('テストファイルの it()/test() 数が YAML case 数と一致しない場合、warn issue が含まれる', async () => {
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'tests', 'login.spec.ts'),
      `
test("a", () => {});
test("b", () => {});
`,
    );
    // screen には 3 cases あるが、テストは 2 つしかない

    const result = await checkCoverage([createScreen()], [], path.join(tempDir, 'tests'));

    expect(result.issues.some((i) => i.level === 'warn')).toBe(true);
    const warnIssue = result.issues.find((i) => i.level === 'warn');
    expect(warnIssue!.message).toContain('3');
    expect(warnIssue!.message).toContain('2');
  });

  it('テストディレクトリが存在しない場合、hasErrors が true でエラーメッセージが返る', async () => {
    const result = await checkCoverage([createScreen()], [], path.join(tempDir, 'nonexistent'));

    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('screen が 0 件のプロジェクトの場合、issues が空配列で hasErrors が false', async () => {
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });

    const result = await checkCoverage([], [], path.join(tempDir, 'tests'));

    expect(result.issues).toEqual([]);
    expect(result.hasErrors).toBe(false);
  });

  it('テストディレクトリが空の場合、全 screen が missing 扱い', async () => {
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });
    // ディレクトリは存在するがファイルなし

    const result = await checkCoverage([createScreen()], [], path.join(tempDir, 'tests'));

    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.level === 'error')).toBe(true);
  });
});

// --- collectTestFiles ---

describe('collectTestFiles', () => {
  it('テストディレクトリ内の .test.ts ファイルを収集する', async () => {
    await writeFile(path.join(tempDir, 'login.test.ts'), 'test("a", () => {});');

    const result = await collectTestFiles(tempDir);

    expect(result.has('login')).toBe(true);
  });

  it('テストディレクトリ内の .spec.ts ファイルを収集する', async () => {
    await writeFile(path.join(tempDir, 'login.spec.ts'), 'test("a", () => {});');

    const result = await collectTestFiles(tempDir);

    expect(result.has('login')).toBe(true);
  });

  it('Tests.swift パターンのファイルを収集する', async () => {
    await writeFile(path.join(tempDir, 'LoginTests.swift'), 'func testLogin() {}');

    const result = await collectTestFiles(tempDir);

    expect(result.has('login')).toBe(true);
  });

  it('テスト以外のファイルを除外する', async () => {
    await writeFile(path.join(tempDir, 'utils.ts'), 'export const x = 1;');
    await writeFile(path.join(tempDir, 'helper.js'), 'const x = 1;');
    await writeFile(path.join(tempDir, 'login.spec.ts'), 'test("a", () => {});');

    const result = await collectTestFiles(tempDir);

    expect(result.has('utils')).toBe(false);
    expect(result.has('helper')).toBe(false);
    expect(result.has('login')).toBe(true);
  });

  it('空のディレクトリを走査すると空の Map が返る', async () => {
    const emptyDir = path.join(tempDir, 'empty');
    await mkdir(emptyDir, { recursive: true });

    const result = await collectTestFiles(emptyDir);

    expect(result.size).toBe(0);
  });
});

// --- countTestCases ---

describe('countTestCases', () => {
  it('it() 呼び出しをカウントする', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(
      filePath,
      `
  it("a", () => {});
  it("b", () => {});
`,
    );

    const count = await countTestCases(filePath);

    expect(count).toBe(2);
  });

  it('test() 呼び出しをカウントする', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(
      filePath,
      `
  test("a", () => {});
  test("b", () => {});
  test("c", () => {});
`,
    );

    const count = await countTestCases(filePath);

    expect(count).toBe(3);
  });

  it('it.todo() と it.skip() もカウントに含める', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(
      filePath,
      `
  it("a", () => {});
  it.todo("b");
  it.skip("c", () => {});
  test.todo("d");
  test.skip("e", () => {});
`,
    );

    const count = await countTestCases(filePath);

    expect(count).toBe(5);
  });

  it('コメント内の it() をカウントしない', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(
      filePath,
      `
  // it("commented", () => {});
  /* it("block commented", () => {}); */
  it("real", () => {});
`,
    );

    const count = await countTestCases(filePath);

    expect(count).toBe(1);
  });

  it('空のファイルでは 0 が返る', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await writeFile(filePath, '');

    const count = await countTestCases(filePath);

    expect(count).toBe(0);
  });
});
