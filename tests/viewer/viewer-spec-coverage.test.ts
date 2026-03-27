import { readdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

const specsDir = resolve(__dirname, '../../docs/tespec/screens/viewer');
const testsDir = resolve(__dirname);

function findTestFile(testFiles: string[], screenId: string): string | undefined {
  return testFiles.find((f) => f === `${screenId}.test.tsx` || f === `${screenId}.test.ts`);
}

function stripTestExt(filename: string): string {
  return filename.replace(/\.test\.tsx?$/, '');
}

describe('Spec-Test 整合性チェック', () => {
  it('全ての YAML screen spec に対応するテストファイルが存在する', async () => {
    const yamlFiles = (await readdir(specsDir)).filter((f) => f.endsWith('.yaml'));
    const testFiles = (await readdir(testsDir)).filter((f) => /\.test\.tsx?$/.test(f));

    for (const yaml of yamlFiles) {
      const screenId = basename(yaml, '.yaml');
      const found = findTestFile(testFiles, screenId);
      expect(found, `${yaml} に対応するテストファイルがない`).toBeTruthy();
    }
  });

  it('全ての YAML case が対応するテストファイル内に存在する', async () => {
    const yamlFiles = (await readdir(specsDir)).filter((f) => f.endsWith('.yaml'));
    const testFiles = (await readdir(testsDir)).filter((f) => /\.test\.tsx?$/.test(f));

    for (const yamlFile of yamlFiles) {
      const screenId = basename(yamlFile, '.yaml');
      const testFile = findTestFile(testFiles, screenId);
      if (!testFile) continue;

      const yamlContent = await readFile(resolve(specsDir, yamlFile), 'utf8');
      const doc = parseDocument(yamlContent);
      const data = doc.toJSON();

      const testContent = await readFile(resolve(testsDir, testFile), 'utf8');

      for (const caseItem of data.cases ?? []) {
        const action = caseItem.action as string;
        expect(
          testContent,
          `${yamlFile} の case "${action}" がテストファイル ${testFile} に含まれていない`,
        ).toContain(action);
      }
    }
  });

  it('テストファイルが YAML spec なしに孤立していない', async () => {
    const yamlFiles = (await readdir(specsDir)).filter((f) => f.endsWith('.yaml'));
    const yamlScreenIds = new Set(yamlFiles.map((f) => basename(f, '.yaml')));

    const testFiles = (await readdir(testsDir)).filter(
      (f) =>
        f.startsWith('viewer-') &&
        /\.test\.tsx?$/.test(f) &&
        !f.startsWith('viewer-watcher') &&
        !f.startsWith('viewer-spec-coverage'),
    );

    for (const testFile of testFiles) {
      const screenId = stripTestExt(testFile);
      expect(
        yamlScreenIds.has(screenId),
        `テストファイル ${testFile} に対応する YAML spec ${screenId}.yaml がない`,
      ).toBe(true);
    }
  });
});
