import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import Validate from '../../src/commands/validate.js';
import { runCommand } from './command-test-utils.js';

const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function configPath(name: string): string {
  return resolve(fixturesRoot, name, 'config.yaml');
}

function fixturePath(...segments: string[]): string {
  return resolve(fixturesRoot, ...segments);
}

describe.sequential('validate command', () => {
  it('returns exit 0 and prints OK lines for a valid project', async () => {
    const result = await runCommand(Validate, ['--config', configPath('command-ok')]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('OK:');
    expect(result.stdout).toContain('screens/home.yaml');
    expect(result.stdout).toContain('screens/login.yaml');
  });

  it('returns exit 1 and prints ERROR lines for reference errors', async () => {
    const result = await runCommand(Validate, ['--config', configPath('command-error')]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
    expect(result.stderr).toContain('setup が見つからない');
    expect(result.stderr).toContain('screen が見つからない');
  });

  it('returns exit 0 and prints WARN lines for warning-only projects', async () => {
    const result = await runCommand(Validate, ['--config', configPath('command-warning')]);

    expect(result.code).toBe(0);
    expect(result.stderr).toContain('WARN:');
    expect(result.stderr).toContain('異常系 (type: error) が 0 件');
  });

  it('returns exit 0 for a valid screen YAML via --file', async () => {
    const filePath = fixturePath('command-ok', 'screens', 'login.yaml');
    const result = await runCommand(Validate, ['--file', filePath]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('OK:');
    expect(result.stdout).toContain('tests/fixtures/command-ok/screens/login.yaml');
  });

  it('returns exit 0 for a valid setup YAML via --file', async () => {
    const filePath = fixturePath('command-ok', 'setups', 'auth.yaml');
    const result = await runCommand(Validate, ['--file', filePath]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('OK:');
    expect(result.stdout).toContain('tests/fixtures/command-ok/setups/auth.yaml');
  });

  it('returns exit 0 and prints OK lines for valid unit specs', async () => {
    const result = await runCommand(Validate, ['--config', configPath('command-unit-ok')]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('OK:');
    expect(result.stdout).toContain('screens/login.yaml');
    expect(result.stdout).toContain('units/user-service.yaml');
  });

  it('returns exit 0 and prints WARN lines for unit warning-only projects', async () => {
    const result = await runCommand(Validate, ['--config', configPath('command-unit-warning')]);

    expect(result.code).toBe(0);
    expect(result.stderr).toContain('WARN:');
    expect(result.stderr).toContain('units/user-service.yaml');
    expect(result.stderr).toContain('異常系 (type: error) が 0 件');
    expect(result.stderr).toContain('境界値 (type: boundary) が 0 件');
    expect(result.stdout).toContain('OK:');
    expect(result.stdout).toContain('units/user-service.yaml');
  });

  it('returns exit 1 and prints ERROR lines for invalid unit specs', async () => {
    const result = await runCommand(Validate, ['--config', configPath('command-unit-error')]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR:');
    expect(result.stderr).toContain('units/user-service.yaml');
    expect(result.stderr).toContain('unit ID "user-service" が重複しています');
  });

  it('returns exit 1 for an invalid YAML via --file', async () => {
    const filePath = fixturePath('invalid-schema', 'screens', 'missing-route.yaml');
    const result = await runCommand(Validate, ['--file', filePath]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('ERROR:');
    expect(result.stderr).toContain('tests/fixtures/invalid-schema/screens/missing-route.yaml');
    expect(result.stderr).toContain('route:');
  });

  it('returns exit 0 for a valid unit YAML via --file', async () => {
    const filePath = fixturePath('command-unit-ok', 'units', 'user-service.yaml');
    const result = await runCommand(Validate, ['--file', filePath]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('OK:');
    expect(result.stdout).toContain('tests/fixtures/command-unit-ok/units/user-service.yaml');
  });

  it('returns exit 1 for an invalid unit YAML via --file', async () => {
    const filePath = fixturePath('invalid-unit-schema', 'units', 'missing-title.yaml');
    const result = await runCommand(Validate, ['--file', filePath]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('ERROR:');
    expect(result.stderr).toContain('tests/fixtures/invalid-unit-schema/units/missing-title.yaml');
    expect(result.stderr).toContain('title:');
  });

  it('returns exit 1 when --file and --config are passed together', async () => {
    const result = await runCommand(Validate, [
      '--config',
      configPath('command-ok'),
      '--file',
      fixturePath('command-ok', 'screens', 'login.yaml'),
    ]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('ERROR:');
    expect(result.stderr).toContain('--file と --config は同時に指定できません');
  });
});
