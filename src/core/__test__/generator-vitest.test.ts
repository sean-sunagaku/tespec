import { describe, expect, it } from 'vitest';

import { generateUnitTestFile } from '../generators/unit/vitest.js';
import type { UnitSpec } from '../schema.js';

describe('generateUnitTestFile', () => {
  it('generates method groups and nested error and boundary sections', () => {
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

    expect(generateUnitTestFile(unit)).toMatchInlineSnapshot(`
      "import { describe, it, expect } from "vitest";

      describe("ユーザーサービス", () => {
        describe("createUser", () => {
          it("有効なメールで作成 → User が返る", () => {
            // TODO: implement
          });
          describe("異常系", () => {
            it("重複メールで作成 → DuplicateEmailError", () => {
              // TODO: implement
            });
          });
          describe("境界値", () => {
            it("空文字メールで作成 → ValidationError", () => {
              // TODO: implement
            });
          });
        });
      });
      "
    `);
  });

  it('uses the first expect entry when expect is an array', () => {
    const unit: UnitSpec = {
      unit: 'session-service',
      title: 'セッションサービス',
      methods: [
        {
          method: 'createSession',
          cases: [
            {
              action: '正常に作成',
              expect: ['Session が返る', '永続化される'],
              type: 'normal',
            },
          ],
        },
      ],
    };

    expect(generateUnitTestFile(unit)).toContain('it("正常に作成 → Session が返る"');
  });
});
