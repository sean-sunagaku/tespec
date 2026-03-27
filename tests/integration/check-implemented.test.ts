import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import CheckImplemented from '../../src/commands/check-implemented.js';
import { runCommand } from './command-test-utils.js';

const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function testsDir(name: string): string {
  return resolve(fixturesRoot, name, 'tests');
}

describe.sequential('check-implemented command', () => {
  it('returns exit 0 and prints OK lines when all tests are implemented', async () => {
    const result = await runCommand(CheckImplemented, [
      '--tests-dir', testsDir('check-impl-ok'),
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('OK:');
    expect(result.stdout).toContain('login');
  });

  it('returns exit 1 and prints WARN lines when TODO markers exist', async () => {
    const result = await runCommand(CheckImplemented, [
      '--tests-dir', testsDir('check-impl-todo'),
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('WARN:');
  });

  it('detects it.todo() and test.skip() as unimplemented', async () => {
    const result = await runCommand(CheckImplemented, [
      '--tests-dir', testsDir('check-impl-todo'),
    ]);

    expect(result.code).toBe(1);
    // dashboard.test.ts に it.todo と test.skip がある
    expect(result.stderr).toContain('dashboard');
  });

  it('returns exit 1 when tests-dir does not exist', async () => {
    const result = await runCommand(CheckImplemented, [
      '--tests-dir', resolve(fixturesRoot, 'nonexistent-dir'),
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('WARN:');
  });

  it('returns exit 0 when tests-dir is empty', async () => {
    const result = await runCommand(CheckImplemented, [
      '--tests-dir', testsDir('check-impl-empty'),
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
  });
});
