import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseProject } from '../parser.js';

const fixturesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../tests/fixtures',
);

function fixtureConfigPath(name: string): string {
  return path.join(fixturesRoot, name, 'config.yaml');
}

describe('parseProject', () => {
  it('parses a valid project with full and minimal screen definitions', async () => {
    const { result, errors } = await parseProject(fixtureConfigPath('valid'));

    expect(errors).toEqual([]);
    expect(result).toBeDefined();
    expect(result?.config.project).toBe('tespec-valid');
    expect(result?.screens).toHaveLength(2);
    expect(result?.setups.map((setup) => setup.setup)).toEqual(
      expect.arrayContaining(['logged_in', 'seed_projects']),
    );
  });

  it('collects schema errors across multiple files without stopping at the first one', async () => {
    const { result, errors } = await parseProject(fixtureConfigPath('invalid-schema'));

    expect(result).toBeUndefined();
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.map((error) => error.file)).toEqual(
      expect.arrayContaining([
        path.join(fixturesRoot, 'invalid-schema', 'screens', 'missing-action.yaml'),
        path.join(fixturesRoot, 'invalid-schema', 'screens', 'missing-route.yaml'),
      ]),
    );
    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('cases.0.action'),
        expect.stringContaining('route'),
      ]),
    );
  });

  it('reports YAML syntax errors with line information', async () => {
    const { result, errors } = await parseProject(fixtureConfigPath('invalid-yaml'));

    expect(result).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.file).toContain(path.join('invalid-yaml', 'screens', 'broken.yaml'));
    expect(errors[0]?.message).toContain('line');
    expect(errors[0]?.message).toContain('column');
  });

  it('allows an empty screens directory', async () => {
    const { result, errors } = await parseProject(fixtureConfigPath('empty-screens'));

    expect(errors).toEqual([]);
    expect(result).toBeDefined();
    expect(result?.screens).toEqual([]);
  });

  it('reports a missing directory as a parse error', async () => {
    const { result, errors } = await parseProject(fixtureConfigPath('missing-dir'));

    expect(result).toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toContain(path.join('missing-dir', 'screens-does-not-exist'));
    expect(errors[0]?.message).toContain('ディレクトリが見つかりません');
  });
});
