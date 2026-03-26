import { describe, expect, it } from 'vitest';
import {
  CaseSchema,
  ConfigSchema,
  ScreenSchema,
  SetupSchema,
  UnitCaseSchema,
  UnitSpecSchema,
} from '../schema.js';

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
      steps: ['open /'],
    });

    expect(result.type).toBe('normal');
  });

  it('fills the default unit case type value when omitted', () => {
    const result = UnitCaseSchema.parse({
      action: 'create user',
      expect: 'user is returned',
    });

    expect(result.type).toBe('normal');
  });

  it('accepts string and string[] forms for given and expect', () => {
    const stringCase = CaseSchema.parse({
      action: 'submit',
      given: 'logged in',
      expect: 'success',
      steps: ['click submit'],
    });
    const arrayCase = CaseSchema.parse({
      action: 'submit',
      given: ['logged in', 'projects seeded'],
      expect: ['success', 'toast shown'],
      steps: ['use:logged_in', 'click submit'],
    });

    expect(stringCase.given).toBe('logged in');
    expect(stringCase.expect).toBe('success');
    expect(arrayCase.given).toEqual(['logged in', 'projects seeded']);
    expect(arrayCase.expect).toEqual(['success', 'toast shown']);
  });

  it('rejects missing steps', () => {
    const result = CaseSchema.safeParse({
      action: 'submit',
      expect: 'success',
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty steps array', () => {
    const result = CaseSchema.safeParse({
      action: 'submit',
      expect: 'success',
      steps: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid type values', () => {
    const result = CaseSchema.safeParse({
      action: 'submit',
      expect: 'success',
      steps: ['click submit'],
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
          steps: ['open /login'],
        },
      ],
    });
    const setup = SetupSchema.parse({
      setup: 'logged_in',
      title: 'Logged in',
      steps: ['sign in'],
    });
    const unit = UnitSpecSchema.parse({
      unit: 'user-service',
      title: 'User service',
      methods: [
        {
          method: 'createUser',
          cases: [
            {
              action: 'create user',
              expect: ['user is returned', 'repository is called'],
            },
          ],
        },
      ],
    });
    const config = ConfigSchema.parse({
      version: 1,
      project: 'tespec',
      units_dir: './units',
    });

    expect(screen.screen).toBe('login');
    expect(setup.setup).toBe('logged_in');
    expect(unit.methods[0]?.cases[0]?.type).toBe('normal');
    expect(config.screens_dir).toBe('./screens');
    expect(config.setups_dir).toBe('./setups');
    expect(config.units_dir).toBe('./units');
  });

  it('keeps units_dir optional in config', () => {
    const config = ConfigSchema.parse({
      version: 1,
      project: 'tespec',
    });

    expect(config.units_dir).toBeUndefined();
  });
});
