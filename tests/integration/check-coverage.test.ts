import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import CheckCoverage from '../../src/commands/check-coverage.js';
import { runCommand } from './command-test-utils.js';

const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function configPath(name: string): string {
  return resolve(fixturesRoot, name, 'config.yaml');
}

function testsDir(name: string): string {
  return resolve(fixturesRoot, name, 'tests');
}

describe.sequential('check-coverage command', () => {
  it('returns exit 0 and prints OK lines when all screens are covered', async () => {
    const result = await runCommand(CheckCoverage, [
      '--config', configPath('check-coverage-ok'),
      '--tests-dir', testsDir('check-coverage-ok'),
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('OK:');
    expect(result.stdout).toContain('login');
    expect(result.stdout).toContain('home');
  });

  it('returns exit 1 and prints ERROR when test file is missing', async () => {
    const result = await runCommand(CheckCoverage, [
      '--config', configPath('check-coverage-missing'),
      '--tests-dir', testsDir('check-coverage-missing'),
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
    expect(result.stderr).toContain('signup');
  });

  it('returns exit 0 and prints WARN when case count mismatches', async () => {
    const result = await runCommand(CheckCoverage, [
      '--config', configPath('check-coverage-mismatch'),
      '--tests-dir', testsDir('check-coverage-mismatch'),
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toContain('WARN:');
    expect(result.stderr).toContain('login');
  });

  it('returns exit 1 when config.yaml does not exist', async () => {
    const result = await runCommand(CheckCoverage, [
      '--config', resolve(fixturesRoot, 'nonexistent', 'config.yaml'),
      '--tests-dir', testsDir('check-coverage-ok'),
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
  });

  it('returns exit 1 when YAML has syntax errors', async () => {
    const result = await runCommand(CheckCoverage, [
      '--config', configPath('check-coverage-invalid-yaml'),
      '--tests-dir', testsDir('check-coverage-ok'),
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
  });

  it('returns exit 1 when screen YAML has schema errors', async () => {
    const result = await runCommand(CheckCoverage, [
      '--config', configPath('check-coverage-invalid-schema'),
      '--tests-dir', testsDir('check-coverage-ok'),
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
  });

  it('returns exit 1 when tests-dir does not exist', async () => {
    const result = await runCommand(CheckCoverage, [
      '--config', configPath('check-coverage-ok'),
      '--tests-dir', resolve(fixturesRoot, 'check-coverage-ok', 'nonexistent'),
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
  });
});
