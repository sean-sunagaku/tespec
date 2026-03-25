import { describe, expect, it } from 'vitest';
import { generateSwiftTestFile } from '../generators/xctest.js';
import type { Screen, Setup } from '../schema.js';

const setups: Setup[] = [
  { setup: 'logged_in', title: 'ログイン済み状態', steps: ['login'] },
  { setup: 'seeded', title: 'プロジェクト3件のシードデータ', steps: ['seed'] },
  { setup: 'offline', title: 'オフライン状態', steps: ['disconnect'] },
];

describe('generateSwiftTestFile', () => {
  it('generates a normal-only screen', () => {
    const screen: Screen = {
      screen: 'login',
      route: '/login',
      title: 'ログイン画面',
      cases: [
        {
          action: '画面を開く',
          expect: 'フォームが表示される',
          steps: ['/login にアクセスする'],
          type: 'normal',
        },
      ],
    };

    expect(generateSwiftTestFile(screen, setups)).toMatchInlineSnapshot(`
      "import XCTest

      final class LoginTests: XCTestCase {
          func test_画面を開く_フォームが表示される() {
              // Steps:
              //   1. /login にアクセスする
              // TODO: implement
          }
      }
      "
    `);
  });

  it('generates MARK sections for error and boundary cases', () => {
    const screen: Screen = {
      screen: 'home',
      route: '/',
      title: 'ホーム画面',
      cases: [
        {
          action: '画面を開く',
          expect: ['一覧が表示される', 'ユーザー名が表示される'],
          steps: ['use:logged_in', 'use:seeded', '/ にアクセスする'],
          given: ['logged_in', 'seeded'],
          type: 'normal',
        },
        {
          action: '画面を開く',
          expect: 'エラーが表示される',
          steps: ['use:offline', '/ にアクセスする'],
          given: 'offline',
          not_expect: ['空の一覧が表示される'],
          type: 'error',
        },
        {
          action: '画面を開く',
          expect: '空状態が表示される',
          steps: ['use:seeded', '/ にアクセスする'],
          given: 'seeded',
          type: 'boundary',
        },
      ],
    };

    const output = generateSwiftTestFile(screen, setups);
    expect(output).toContain('import XCTest');
    expect(output).toContain('final class HomeTests: XCTestCase {');
    expect(output).toContain('// MARK: - 異常系');
    expect(output).toContain('// MARK: - 境界値');
    expect(output).toContain('// Given: オフライン状態');
    expect(output).toContain('// not_expect: 空の一覧が表示される');
    expect(output).toContain('func test_画面を開く_一覧が表示される()');
    expect(output).toContain('func test_offline_画面を開く_エラーが表示される()');
  });

  it('uses 4-space indentation', () => {
    const screen: Screen = {
      screen: 'settings',
      route: '/settings',
      title: '設定画面',
      cases: [
        {
          action: '画面を開く',
          expect: '設定一覧が表示される',
          steps: ['/settings にアクセスする'],
          type: 'normal',
        },
      ],
    };

    const output = generateSwiftTestFile(screen, setups);
    expect(output).toContain('    func test_');
    expect(output).toContain('        // TODO: implement');
  });

  it('converts screen id to PascalCase class name', () => {
    const screen: Screen = {
      screen: 'user-profile',
      route: '/user/profile',
      title: 'ユーザープロフィール',
      cases: [
        {
          action: '画面を開く',
          expect: 'プロフィールが表示される',
          steps: ['/user/profile にアクセスする'],
          type: 'normal',
        },
      ],
    };

    expect(generateSwiftTestFile(screen, setups)).toContain(
      'final class UserProfileTests: XCTestCase {',
    );
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
          steps: ['/detail にアクセスする'],
          given: 'temporary_state',
          type: 'boundary',
        },
      ],
    };

    expect(generateSwiftTestFile(screen, setups)).toContain('// Given: temporary_state');
  });
});
