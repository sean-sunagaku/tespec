import { describe, expect, it } from 'vitest';

import type { Screen, Setup } from '../schema.js';
import { generateTestFile } from '../generator.js';

const setups: Setup[] = [
  { setup: 'logged_in', title: 'ログイン済み状態', steps: ['login'] },
  { setup: 'seeded', title: 'プロジェクト3件のシードデータ', steps: ['seed'] },
  { setup: 'offline', title: 'オフライン状態', steps: ['disconnect'] },
];

describe('generateTestFile', () => {
  it('generates a normal-only screen', () => {
    const screen: Screen = {
      screen: 'login',
      route: '/login',
      title: 'ログイン画面',
      cases: [
        {
          action: '画面を開く',
          expect: 'フォームが表示される',
          type: 'normal',
        },
      ],
    };

    expect(generateTestFile(screen, setups)).toMatchInlineSnapshot(`
      "import { test, expect } from "@playwright/test";
      
      test.describe("ログイン画面", () => {
        test("画面を開く → フォームが表示される", async () => {
          // TODO: implement
        });
      });
      "
    `);
  });

  it('generates grouped sections for normal, error, and boundary cases', () => {
    const screen: Screen = {
      screen: 'home',
      route: '/',
      title: 'ホーム画面',
      cases: [
        {
          action: '画面を開く',
          expect: ['一覧が表示される', 'ユーザー名が表示される'],
          given: ['logged_in', 'seeded'],
          type: 'normal',
        },
        {
          action: '画面を開く',
          expect: 'エラーが表示される',
          given: 'offline',
          not_expect: ['空の一覧が表示される'],
          type: 'error',
        },
        {
          action: '画面を開く',
          expect: '空状態が表示される',
          given: 'seeded',
          type: 'boundary',
        },
      ],
    };

    expect(generateTestFile(screen, setups)).toMatchInlineSnapshot(`
      "import { test, expect } from "@playwright/test";
      
      test.describe("ホーム画面", () => {
        test("画面を開く → 一覧が表示される", async () => {
          // Given: ログイン済み状態, プロジェクト3件のシードデータ
          // TODO: implement
        });
        test.describe("異常系", () => {
          test("[offline] 画面を開く → エラーが表示される", async () => {
            // Given: オフライン状態
            // not_expect: 空の一覧が表示される
            // TODO: implement
          });
        });
        test.describe("境界値", () => {
          test("[seeded] 画面を開く → 空状態が表示される", async () => {
            // Given: プロジェクト3件のシードデータ
            // TODO: implement
          });
        });
      });
      "
    `);
  });

  it('keeps raw given text when setup metadata is unavailable', () => {
    const screen: Screen = {
      screen: 'detail',
      route: '/detail',
      title: '詳細画面',
      cases: [
        {
          action: '画面を開く',
          expect: '詳細が表示される',
          given: 'temporary_state',
          type: 'boundary',
        },
      ],
    };

    expect(generateTestFile(screen, setups)).toContain('// Given: temporary_state');
    expect(generateTestFile(screen, setups)).toContain('[temporary_state] 画面を開く → 詳細が表示される');
  });
});
