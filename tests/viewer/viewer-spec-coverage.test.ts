import { readdir, readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseDocument } from 'yaml';

const specsDir = resolve(__dirname, '../../docs/tespec/screens/viewer');
const testsDir = resolve(__dirname);

describe('Spec-Test 整合性チェック', () => {
  it('全ての YAML screen spec に対応するテストファイルが存在する', async () => {
    const yamlFiles = (await readdir(specsDir)).filter((f) => f.endsWith('.yaml'));
    const testFiles = (await readdir(testsDir)).filter((f) => f.endsWith('.test.ts'));

    for (const yaml of yamlFiles) {
      const screenId = basename(yaml, '.yaml');
      const expectedTestFile = `${screenId}.test.ts`;
      expect(testFiles, `${yaml} に対応するテストファイル ${expectedTestFile} がない`).toContain(
        expectedTestFile,
      );
    }
  });

  it('全ての YAML case が対応するテストファイル内に存在する', async () => {
    const yamlFiles = (await readdir(specsDir)).filter((f) => f.endsWith('.yaml'));

    for (const yamlFile of yamlFiles) {
      const screenId = basename(yamlFile, '.yaml');
      const testFilePath = resolve(testsDir, `${screenId}.test.ts`);

      const yamlContent = await readFile(resolve(specsDir, yamlFile), 'utf8');
      const doc = parseDocument(yamlContent);
      const data = doc.toJSON();

      let testContent: string;
      try {
        testContent = await readFile(testFilePath, 'utf8');
      } catch {
        // ファイルが存在しない場合は前のテストで検出済み
        continue;
      }

      for (const caseItem of data.cases ?? []) {
        const action = caseItem.action as string;
        expect(
          testContent,
          `${yamlFile} の case "${action}" がテストファイル ${screenId}.test.ts に含まれていない`,
        ).toContain(action);
      }
    }
  });

  it('テストファイルが YAML spec なしに孤立していない', async () => {
    const yamlFiles = (await readdir(specsDir)).filter((f) => f.endsWith('.yaml'));
    const yamlScreenIds = new Set(yamlFiles.map((f) => basename(f, '.yaml')));

    const testFiles = (await readdir(testsDir)).filter(
      (f) => f.startsWith('viewer-') && f.endsWith('.test.ts') && f !== 'viewer-watcher.test.ts' && f !== 'viewer-spec-coverage.test.ts',
    );

    for (const testFile of testFiles) {
      const screenId = basename(testFile, '.test.ts');
      expect(
        yamlScreenIds.has(screenId),
        `テストファイル ${testFile} に対応する YAML spec ${screenId}.yaml がない`,
      ).toBe(true);
    }
  });
});
