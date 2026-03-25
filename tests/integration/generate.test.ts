import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import Generate from '../../src/commands/generate.js';
import { runCommand } from './command-test-utils.js';

const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function configPath(name: string): string {
  return resolve(fixturesRoot, name, 'config.yaml');
}

describe.sequential('generate command', () => {
  it('prints Playwright skeletons on dry-run', async () => {
    const result = await runCommand(Generate, [
      '--config',
      configPath('command-ok'),
      '--dry-run',
      '--out-dir',
      'tests/generated',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('// tests/generated/home.spec.ts');
    expect(result.stdout).toContain('test.describe("ホーム画面"');
    expect(result.stdout).toContain('files generated');
  });

  it('returns exit 1 and does not generate when validation errors exist', async () => {
    const result = await runCommand(Generate, [
      '--config',
      configPath('command-error'),
      '--dry-run',
      '--out-dir',
      'tests/generated',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
    expect(result.stdout).not.toContain('// tests/');
    expect(result.stdout).not.toContain('files generated');
  });

  it('filters generation by screen ID', async () => {
    const result = await runCommand(Generate, [
      '--config',
      configPath('command-ok'),
      '--dry-run',
      '--out-dir',
      'tests/generated',
      '--screen',
      'login',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('// tests/generated/login.spec.ts');
    expect(result.stdout).not.toContain('// tests/generated/home.spec.ts');
    expect(result.stdout).toContain('test.describe("ログイン画面"');
  });

  it('writes generated files to a custom output directory', async () => {
    const outputDir = await mkdtemp(resolve(tmpdir(), 'tespec-generate-'));

    const result = await runCommand(Generate, [
      '--config',
      configPath('command-ok'),
      '--out-dir',
      outputDir,
    ]);

    expect(result.code).toBe(0);

    const homeSpec = await readFile(resolve(outputDir, 'home.spec.ts'), 'utf8');
    const loginSpec = await readFile(resolve(outputDir, 'login.spec.ts'), 'utf8');

    expect(homeSpec).toContain('test.describe("ホーム画面"');
    expect(loginSpec).toContain('test.describe("ログイン画面"');
  });
});
