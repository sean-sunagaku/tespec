import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import Validate from '../../src/commands/validate.js';
import { runCommand } from './command-test-utils.js';

const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function configPath(name: string): string {
  return resolve(fixturesRoot, name, 'config.yaml');
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
});
