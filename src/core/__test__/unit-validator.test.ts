import { describe, expect, it } from 'vitest';

import type { UnitSpec } from '../schema.js';
import { validateUnits } from '../unit-validator.js';

function createUnit(overrides: Partial<UnitSpec> = {}): UnitSpec {
  return {
    unit: 'user-service',
    title: 'User service',
    methods: [
      {
        method: 'createUser',
        cases: [
          {
            action: 'create user',
            expect: 'user is returned',
            type: 'normal',
          },
          {
            action: 'duplicate email',
            expect: 'DuplicateEmailError',
            type: 'error',
          },
          {
            action: 'empty email',
            expect: 'ValidationError',
            type: 'boundary',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('validateUnits', () => {
  it('returns no issues for a fully covered valid unit spec list', () => {
    const result = validateUnits([
      createUnit(),
      createUnit({
        unit: 'billing-service',
        title: 'Billing service',
        methods: [
          {
            method: 'charge',
            cases: [
              {
                action: 'successful charge',
                expect: 'receipt is returned',
                type: 'normal',
              },
              {
                action: 'declined card',
                expect: 'CardDeclinedError',
                type: 'error',
              },
              {
                action: 'zero amount',
                expect: 'ValidationError',
                type: 'boundary',
              },
            ],
          },
        ],
      }),
    ]);

    expect(result).toEqual({
      issues: [],
      hasErrors: false,
    });
  });

  it('reports duplicate unit IDs as errors', () => {
    const result = validateUnits([
      createUnit({ unit: 'user-service' }),
      createUnit({ unit: 'user-service', title: 'Duplicate user service' }),
    ]);

    expect(result.hasErrors).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          file: 'units/user-service.yaml',
          field: 'unit',
          message: 'unit ID "user-service" が重複しています',
        }),
      ]),
    );
  });

  it('reports empty methods as a warning', () => {
    const result = validateUnits([
      createUnit({
        methods: [],
      }),
    ]);

    expect(result.hasErrors).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          file: 'units/user-service.yaml',
          field: 'methods',
          message: 'methods が空です',
        }),
      ]),
    );
  });

  it('reports empty method cases and missing type coverage as warnings', () => {
    const result = validateUnits([
      createUnit({
        methods: [
          {
            method: 'createUser',
            cases: [],
          },
          {
            method: 'deleteUser',
            cases: [
              {
                action: 'delete existing user',
                expect: 'success',
                type: 'normal',
              },
            ],
          },
        ],
      }),
    ]);

    expect(result.hasErrors).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'methods[0].cases',
          message: 'cases が空です',
        }),
        expect.objectContaining({
          field: 'methods[0].cases',
          message: '異常系 (type: error) が 0 件',
        }),
        expect.objectContaining({
          field: 'methods[0].cases',
          message: '境界値 (type: boundary) が 0 件',
        }),
        expect.objectContaining({
          field: 'methods[1].cases',
          message: '異常系 (type: error) が 0 件',
        }),
        expect.objectContaining({
          field: 'methods[1].cases',
          message: '境界値 (type: boundary) が 0 件',
        }),
      ]),
    );
  });
});
