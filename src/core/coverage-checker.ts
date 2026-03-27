import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Screen, UnitSpec } from './schema.js';

// --- 型定義 ---

export interface CoverageIssue {
  level: 'ok' | 'warn' | 'error';
  specFile: string;
  testFile?: string;
  message: string;
}

export interface CoverageResult {
  issues: CoverageIssue[];
  hasErrors: boolean;
}

// --- テストファイルパターン ---

const TEST_FILE_PATTERN = /\.(spec|test)\.(ts|tsx|js|jsx)$|Tests\.swift$/;

// --- メイン関数 ---

export async function checkCoverage(
  screens: Screen[],
  units: UnitSpec[],
  testsDir: string,
): Promise<CoverageResult> {
  let testFiles: Map<string, string>;

  try {
    testFiles = await collectTestFiles(testsDir);
  } catch {
    const issues: CoverageIssue[] = [
      ...screens.map((screen) => ({
        level: 'error' as const,
        specFile: `screens/${screen.screen}.yaml`,
        message: `テストディレクトリが見つかりません: ${testsDir}`,
      })),
      ...units.map((unit) => ({
        level: 'error' as const,
        specFile: `units/${unit.unit}.yaml`,
        message: `テストディレクトリが見つかりません: ${testsDir}`,
      })),
    ];

    if (issues.length === 0) {
      return { issues: [], hasErrors: false };
    }

    return { issues, hasErrors: true };
  }

  const issues: CoverageIssue[] = [];

  // screens チェック
  for (const screen of screens) {
    const specFile = `screens/${screen.screen}.yaml`;
    const stem = screen.screen;
    const testFilePath = testFiles.get(stem);

    if (!testFilePath) {
      issues.push({
        level: 'error',
        specFile,
        message: 'テストファイルが見つかりません',
      });
      continue;
    }

    const testFileName = path.basename(testFilePath);
    const expectedCases = screen.cases.length;
    const actualCases = await countTestCases(testFilePath);

    if (expectedCases !== actualCases) {
      issues.push({
        level: 'warn',
        specFile,
        testFile: testFileName,
        message: `case 数が一致しません (期待: ${expectedCases}, 実際: ${actualCases})`,
      });
    } else {
      issues.push({
        level: 'ok',
        specFile,
        testFile: testFileName,
        message: `${testFileName} (${actualCases}/${expectedCases} cases)`,
      });
    }
  }

  // units チェック
  for (const unit of units) {
    const specFile = `units/${unit.unit}.yaml`;
    const stem = unit.unit;
    const testFilePath = testFiles.get(stem);

    if (!testFilePath) {
      issues.push({
        level: 'error',
        specFile,
        message: 'テストファイルが見つかりません',
      });
      continue;
    }

    const testFileName = path.basename(testFilePath);
    const expectedCases = countYamlUnitCases(unit);
    const actualCases = await countTestCases(testFilePath);

    if (expectedCases !== actualCases) {
      issues.push({
        level: 'warn',
        specFile,
        testFile: testFileName,
        message: `case 数が一致しません (期待: ${expectedCases}, 実際: ${actualCases})`,
      });
    } else {
      issues.push({
        level: 'ok',
        specFile,
        testFile: testFileName,
        message: `${testFileName} (${actualCases}/${expectedCases} cases)`,
      });
    }
  }

  return {
    issues,
    hasErrors: issues.some((i) => i.level === 'error'),
  };
}

// --- ヘルパー関数 ---

export async function collectTestFiles(dir: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  let dirents: Awaited<ReturnType<typeof readdir<{ withFileTypes: true }>>>;

  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);

    if (dirent.isFile() && TEST_FILE_PATTERN.test(dirent.name)) {
      const stem = extractStem(dirent.name);
      result.set(stem, fullPath);
    } else if (dirent.isDirectory()) {
      const subResult = await collectTestFiles(fullPath);
      for (const [stem, filePath] of subResult) {
        if (!result.has(stem)) {
          result.set(stem, filePath);
        }
      }
    }
  }

  return result;
}

function extractStem(fileName: string): string {
  // LoginTests.swift → login
  if (fileName.endsWith('Tests.swift')) {
    return fileName.replace(/Tests\.swift$/, '').toLowerCase();
  }

  // login.spec.ts → login, login.test.tsx → login
  return fileName.replace(/\.(spec|test)\.(ts|tsx|js|jsx)$/, '').toLowerCase();
}

function countYamlUnitCases(unit: UnitSpec): number {
  return unit.methods.flatMap((m) => m.cases).length;
}

export async function countTestCases(filePath: string): Promise<number> {
  const content = await readFile(filePath, 'utf8');

  if (content.trim() === '') {
    return 0;
  }

  // コメント行を除外
  const lines = content.split('\n');
  const nonCommentLines = lines.filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
  });
  const cleanContent = nonCommentLines.join('\n');

  // it(), test(), it.todo(), it.skip(), test.todo(), test.skip() をカウント
  const pattern = /^\s*(it|test)(\.(todo|skip))?\s*\(/gm;
  const matches = cleanContent.match(pattern);

  return matches ? matches.length : 0;
}
