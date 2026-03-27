import { describe, expect, it } from 'vitest';

import { generateTestFile } from '../generators/screen/vitest.js';
import type { Screen, Setup } from '../schema.js';

const setups: Setup[] = [
  { setup: 'logged_in', title: 'ログイン済み状態', steps: ['テストユーザーでログイン'] },
];

describe('generateTestFile (vitest screen)', () => {
  it('generates describe/it blocks with vitest imports', () => {
    const screen: Screen = {
      screen: 'login',
      route: '/login',
      title: 'ログイン画面',
      cases: [
        {
          action: '画面を開く',
          steps: ['/login にアクセスする'],
          expect: 'フォームが表示される',
          type: 'normal',
        },
      ],
    };

    const output = generateTestFile(screen, []);

    expect(output).toContain('import { describe, it, expect } from "vitest"');
    expect(output).toContain('describe("ログイン画面"');
    expect(output).toContain('it("画面を開く → フォームが表示される"');
    expect(output).toContain('// TODO: implement');
    expect(output).not.toContain('@playwright/test');
  });

  it('groups cases by type with nested describe blocks', () => {
    const screen: Screen = {
      screen: 'home',
      route: '/',
      title: 'ホーム画面',
      cases: [
        { action: '開く', steps: ['/ にアクセス'], expect: '一覧表示', type: 'normal' },
        { action: 'エラー', steps: ['/ にアクセス'], expect: 'エラー表示', type: 'error' },
        { action: '空一覧', steps: ['/ にアクセス'], expect: '空表示', type: 'boundary' },
      ],
    };

    const output = generateTestFile(screen, []);

    expect(output).toContain('it("開く → 一覧表示"');
    expect(output).toContain('describe("異常系"');
    expect(output).toContain('it("エラー → エラー表示"');
    expect(output).toContain('describe("境界値"');
    expect(output).toContain('it("空一覧 → 空表示"');
  });

  it('includes given comment with setup title resolution', () => {
    const screen: Screen = {
      screen: 'home',
      route: '/',
      title: 'ホーム画面',
      cases: [
        {
          action: '開く',
          given: 'logged_in',
          steps: ['use:logged_in', '/ にアクセスする'],
          expect: '一覧表示',
          type: 'normal',
        },
      ],
    };

    const output = generateTestFile(screen, setups);

    expect(output).toContain('// Given: ログイン済み状態');
    expect(output).toContain('[use:logged_in] ログイン済み状態');
  });

  it('includes navigates_to comment', () => {
    const screen: Screen = {
      screen: 'login',
      route: '/login',
      title: 'ログイン画面',
      cases: [
        {
          action: 'ログインする',
          steps: ['送信ボタンをクリック'],
          expect: 'ホームに遷移',
          type: 'normal',
          navigates_to: 'home',
        },
      ],
    };

    const output = generateTestFile(screen, []);

    expect(output).toContain('// navigates_to: home');
  });

  it('includes not_expect comment', () => {
    const screen: Screen = {
      screen: 'login',
      route: '/login',
      title: 'ログイン画面',
      cases: [
        {
          action: 'エラー入力',
          steps: ['送信'],
          expect: 'エラー表示',
          type: 'error',
          not_expect: ['ホームに遷移する'],
        },
      ],
    };

    const output = generateTestFile(screen, []);

    expect(output).toContain('// not_expect: ホームに遷移する');
  });

  it('prefixes given in test name for non-normal types', () => {
    const screen: Screen = {
      screen: 'home',
      route: '/',
      title: 'ホーム画面',
      cases: [
        {
          action: 'エラー状態で開く',
          given: 'logged_in',
          steps: ['/ にアクセス'],
          expect: 'エラー表示',
          type: 'error',
        },
      ],
    };

    const output = generateTestFile(screen, setups);

    expect(output).toContain('it("[logged_in] エラー状態で開く → エラー表示"');
  });

  it('uses first expect entry when expect is an array', () => {
    const screen: Screen = {
      screen: 'home',
      route: '/',
      title: 'ホーム画面',
      cases: [
        {
          action: '開く',
          steps: ['/ にアクセス'],
          expect: ['一覧表示', 'ナビ表示'],
          type: 'normal',
        },
      ],
    };

    const output = generateTestFile(screen, []);

    expect(output).toContain('it("開く → 一覧表示"');
  });

  it('generates .test.ts file name', async () => {
    const { vitest } = await import('../generators/screen/vitest.js');
    expect(vitest.fileNameFor('login')).toBe('login.test.ts');
    expect(vitest.fileNameFor('viewer-dashboard')).toBe('viewer-dashboard.test.ts');
  });
});
