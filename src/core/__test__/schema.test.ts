import { describe, expect, it } from 'vitest';
import { CaseSchema, ConfigSchema, ScreenSchema, SetupSchema } from '../schema.js';

describe('schema', () => {
  it('rejects missing required fields', () => {
    const result = ScreenSchema.safeParse({
      route: '/login',
      title: 'Login',
      cases: [],
    });

    expect(result.success).toBe(false);
  });

  it('fills the default type value when omitted', () => {
    const result = CaseSchema.parse({
      action: 'open screen',
      expect: 'home is visible',
    });

    expect(result.type).toBe('normal');
  });

  it('accepts string and string[] forms for given and expect', () => {
    const stringCase = CaseSchema.parse({
      action: 'submit',
      given: 'logged in',
      expect: 'success',
    });
    const arrayCase = CaseSchema.parse({
      action: 'submit',
      given: ['logged in', 'projects seeded'],
      expect: ['success', 'toast shown'],
    });

    expect(stringCase.given).toBe('logged in');
    expect(stringCase.expect).toBe('success');
    expect(arrayCase.given).toEqual(['logged in', 'projects seeded']);
    expect(arrayCase.expect).toEqual(['success', 'toast shown']);
  });

  it('rejects invalid type values', () => {
    const result = CaseSchema.safeParse({
      action: 'submit',
      expect: 'success',
      type: 'invalid',
    });

    expect(result.success).toBe(false);
  });

  it('parses the remaining schemas', () => {
    const screen = ScreenSchema.parse({
      screen: 'login',
      route: '/login',
      title: 'Login',
      cases: [
        {
          action: 'open',
          expect: 'form visible',
        },
      ],
    });
    const setup = SetupSchema.parse({
      setup: 'logged_in',
      title: 'Logged in',
      steps: ['sign in'],
    });
    const config = ConfigSchema.parse({
      version: 1,
      project: 'tespec',
    });

    expect(screen.screen).toBe('login');
    expect(setup.setup).toBe('logged_in');
    expect(config.screens_dir).toBe('./screens');
    expect(config.setups_dir).toBe('./setups');
  });
});
