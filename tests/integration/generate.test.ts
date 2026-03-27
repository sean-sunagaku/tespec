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

function expectStepsInOrder(output: string, steps: string[]): void {
  for (const step of steps) {
    expect(output).toContain(step);
  }
  let lastIndex = -1;
  for (const step of steps) {
    const index = output.indexOf(step);
    expect(index).toBeGreaterThan(lastIndex);
    lastIndex = index;
  }
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
    expectStepsInOrder(result.stdout, [
      '[use:logged_in] ログイン済み状態',
      '[use:seed_projects] プロジェクト3件のシードデータ',
      '/ にアクセスする',
    ]);
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

  it('prints Screen and Unit skeletons on dry-run when units_dir is configured', async () => {
    const result = await runCommand(Generate, [
      '--config',
      configPath('command-unit-ok'),
      '--dry-run',
      '--out-dir',
      'tests/generated',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('// tests/generated/login.spec.ts');
    expect(result.stdout).toContain('// tests/generated/user-service.test.ts');
    expect(result.stdout).toContain('test.describe("ログイン画面"');
    expect(result.stdout).toContain('import { describe, it, expect } from');
    expect(result.stdout).toContain('createUser');
    expect(result.stdout).toContain('DuplicateEmailError');
    expect(result.stdout).toContain('files generated');
  });

  it('returns exit 1 and does not generate when unit validation errors exist', async () => {
    const result = await runCommand(Generate, [
      '--config',
      configPath('command-unit-error'),
      '--dry-run',
      '--out-dir',
      'tests/generated',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
    expect(result.stderr).toContain('unit ID "user-service" が重複しています');
    expect(result.stdout).not.toContain('// tests/generated/user-service.test.ts');
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
    expectStepsInOrder(result.stdout, [
      '/login にアクセスする',
      '誤った認証情報を入力する',
      '送信ボタンをクリックする',
    ]);
  });

  it('filters generation by unit ID', async () => {
    const result = await runCommand(Generate, [
      '--config',
      configPath('command-unit-ok'),
      '--dry-run',
      '--out-dir',
      'tests/generated',
      '--unit',
      'user-service',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('// tests/generated/user-service.test.ts');
    expect(result.stdout).not.toContain('// tests/generated/login.spec.ts');
    expect(result.stdout).toContain('createUser');
    expect(result.stdout).toContain('DuplicateEmailError');
  });

  it('prints vitest screen skeletons on dry-run with -t vitest', async () => {
    const result = await runCommand(Generate, [
      '--config',
      configPath('command-ok'),
      '--dry-run',
      '--out-dir',
      'tests/generated',
      '--target',
      'vitest',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('// tests/generated/home.test.ts');
    expect(result.stdout).toContain('describe("ホーム画面"');
    expect(result.stdout).toContain('import { describe, it, expect } from "vitest"');
    expect(result.stdout).not.toContain('@playwright/test');
    expectStepsInOrder(result.stdout, [
      '[use:logged_in] ログイン済み状態',
      '[use:seed_projects] プロジェクト3件のシードデータ',
      '/ にアクセスする',
    ]);
    expect(result.stdout).toContain('files generated');
  });

  it('supports a separate unit target', async () => {
    const result = await runCommand(Generate, [
      '--config',
      configPath('command-unit-ok'),
      '--dry-run',
      '--out-dir',
      'tests/generated',
      '--unit-target',
      'xctest',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('// tests/generated/login.spec.ts');
    expect(result.stdout).toContain('// tests/generated/UserServiceTests.swift');
    expect(result.stdout).toContain('final class UserServiceTests: XCTestCase');
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
    expectStepsInOrder(homeSpec, [
      '[use:logged_in] ログイン済み状態',
      '[use:seed_projects] プロジェクト3件のシードデータ',
      '/ にアクセスする',
    ]);
    expect(loginSpec).toContain('test.describe("ログイン画面"');
    expectStepsInOrder(loginSpec, ['/login にアクセスする']);
  });

  it('writes generated unit files to a custom output directory', async () => {
    const outputDir = await mkdtemp(resolve(tmpdir(), 'tespec-generate-unit-'));

    const result = await runCommand(Generate, [
      '--config',
      configPath('command-unit-ok'),
      '--out-dir',
      outputDir,
    ]);

    expect(result.code).toBe(0);

    const loginSpec = await readFile(resolve(outputDir, 'login.spec.ts'), 'utf8');
    const unitSpec = await readFile(resolve(outputDir, 'user-service.test.ts'), 'utf8');

    expect(loginSpec).toContain('test.describe("ログイン画面"');
    expect(unitSpec).toContain('import { describe, it, expect } from');
    expect(unitSpec).toContain('createUser');
    expect(unitSpec).toContain('ValidationError');
  });
});
