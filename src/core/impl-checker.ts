import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// --- 型定義 ---

export interface ImplIssue {
  level: 'ok' | 'warn';
  file: string;
  total: number;
  implemented: number;
  message: string;
}

export interface ImplResult {
  issues: ImplIssue[];
  hasUnimplemented: boolean;
}

// --- テストファイルパターン ---

const TEST_FILE_PATTERN = /\.(spec|test)\.(ts|tsx|js|jsx)$|Tests\.swift$/;

// --- 未実装検出パターン ---

const TODO_MARKER = /\/\/\s*TODO:\s*implement/g;
const TODO_TEST = /^\s*(it|test)\.todo\s*\(/gm;
const SKIP_TEST = /^\s*(it|test)\.skip\s*\(/gm;

// --- メイン関数 ---

export async function checkImplemented(testsDir: string): Promise<ImplResult> {
  const testFiles = await collectTestFilePaths(testsDir);
  const issues: ImplIssue[] = [];

  if (testFiles === null) {
    return {
      issues: [
        {
          level: 'warn',
          file: testsDir,
          total: 0,
          implemented: 0,
          message: `テストディレクトリが見つかりません: ${testsDir}`,
        },
      ],
      hasUnimplemented: true,
    };
  }

  for (const filePath of testFiles) {
    const fileName = path.basename(filePath);
    const { total, unimplemented } = await countUnimplemented(filePath);

    if (total === 0) {
      // テストが 0 件のファイルは ok 扱い
      issues.push({
        level: 'ok',
        file: fileName,
        total: 0,
        implemented: 0,
        message: `${fileName} (0/0 implemented)`,
      });
      continue;
    }

    const implemented = total - unimplemented;

    if (unimplemented > 0) {
      issues.push({
        level: 'warn',
        file: fileName,
        total,
        implemented,
        message: `${fileName} (${implemented}/${total} implemented, ${unimplemented} todo)`,
      });
    } else {
      issues.push({
        level: 'ok',
        file: fileName,
        total,
        implemented,
        message: `${fileName} (${implemented}/${total} implemented)`,
      });
    }
  }

  return {
    issues,
    hasUnimplemented: issues.some((i) => i.level === 'warn'),
  };
}

// --- ヘルパー関数 ---

async function collectTestFilePaths(dir: string): Promise<string[] | null> {
  let dirents: Awaited<ReturnType<typeof readdir<{ withFileTypes: true }>>>;

  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const files: string[] = [];

  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);

    if (dirent.isFile() && TEST_FILE_PATTERN.test(dirent.name)) {
      files.push(fullPath);
    } else if (dirent.isDirectory()) {
      const subFiles = await collectTestFilePaths(fullPath);
      if (subFiles) {
        files.push(...subFiles);
      }
    }
  }

  return files.sort();
}

export async function countUnimplemented(
  filePath: string,
): Promise<{ total: number; unimplemented: number }> {
  const content = await readFile(filePath, 'utf8');

  if (content.trim() === '') {
    return { total: 0, unimplemented: 0 };
  }

  // 総テスト数: it() / test() / it.todo() / it.skip() / test.todo() / test.skip()
  const totalPattern = /^\s*(it|test)(\.(todo|skip))?\s*\(/gm;
  const totalMatches = content.match(totalPattern);
  const total = totalMatches ? totalMatches.length : 0;

  // 未実装カウント
  let unimplemented = 0;

  // TODO: implement マーカー
  const todoMarkerMatches = content.match(TODO_MARKER);
  if (todoMarkerMatches) {
    unimplemented += todoMarkerMatches.length;
  }

  // it.todo() / test.todo()
  const todoTestMatches = content.match(TODO_TEST);
  if (todoTestMatches) {
    unimplemented += todoTestMatches.length;
  }

  // it.skip() / test.skip()
  const skipTestMatches = content.match(SKIP_TEST);
  if (skipTestMatches) {
    unimplemented += skipTestMatches.length;
  }

  return { total, unimplemented };
}
