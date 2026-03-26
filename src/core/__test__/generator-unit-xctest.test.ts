import { describe, expect, it } from 'vitest';

import { generateSwiftUnitTestFile } from '../generators/unit/xctest.js';
import type { UnitSpec } from '../schema.js';

describe('generateSwiftUnitTestFile', () => {
  it('generates a MARK section per method and Swift test function names', () => {
    const unit: UnitSpec = {
      unit: 'user-service',
      title: 'ユーザーサービス',
      methods: [
        {
          method: 'createUser',
          cases: [
            {
              action: '有効なメールで作成',
              expect: 'User が返る',
              type: 'normal',
            },
            {
              action: '重複メールで作成',
              expect: 'DuplicateEmailError',
              type: 'error',
            },
            {
              action: '空文字メールで作成',
              expect: 'ValidationError',
              type: 'boundary',
            },
          ],
        },
      ],
    };

    const output = generateSwiftUnitTestFile(unit);

    expect(output).toContain('import XCTest');
    expect(output).toContain('final class UserServiceTests: XCTestCase {');
    expect(output).toContain('// MARK: - createUser');
    expect(output).toContain('func test_createUser_有効なメールで作成_User_が返る()');
    expect(output).toContain('func test_createUser_重複メールで作成_DuplicateEmailError()');
    expect(output).toContain('func test_createUser_空文字メールで作成_ValidationError()');
  });

  it('converts kebab-case unit ids to PascalCase class names', () => {
    const unit: UnitSpec = {
      unit: 'payment-session',
      title: '決済セッション',
      methods: [
        {
          method: 'createSession',
          cases: [
            {
              action: '正常に作成',
              expect: 'Session が返る',
              type: 'normal',
            },
          ],
        },
      ],
    };

    expect(generateSwiftUnitTestFile(unit)).toContain(
      'final class PaymentSessionTests: XCTestCase {',
    );
  });
});
