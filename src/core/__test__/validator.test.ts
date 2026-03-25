import { describe, expect, it } from 'vitest';

import type { Screen, Setup } from '../schema.js';
import { validate } from '../validator.js';

function createSetup(setup: string): Setup {
  return {
    setup,
    title: setup,
    steps: [`${setup} step`],
  };
}

function createCompleteCases(): Screen['cases'] {
  return [
    {
      action: '画面を開く',
      expect: '一覧が表示される',
      steps: ['/ にアクセスする'],
      type: 'normal',
    },
    {
      action: '不正入力を送信する',
      expect: 'エラーが表示される',
      steps: ['/ にアクセスする', '不正な値を入力する'],
      type: 'error',
    },
    {
      action: '大量データで開く',
      expect: 'ページネーションが表示される',
      steps: ['/ にアクセスする'],
      type: 'boundary',
    },
  ];
}

function createScreen(overrides: Partial<Screen> = {}): Screen {
  return {
    screen: 'home',
    route: '/',
    title: 'ホーム画面',
    cases: createCompleteCases(),
    ...overrides,
  };
}

describe('validate', () => {
  it('returns no issues for a fully covered valid project', () => {
    const screens = [
      createScreen(),
      createScreen({
        screen: 'login',
        route: '/login',
        title: 'ログイン画面',
        cases: [
          {
            action: '画面を開く',
            expect: 'フォームが表示される',
            steps: ['/login にアクセスする'],
            type: 'normal',
            navigates_to: 'home',
          },
          {
            action: '誤った資格情報を送信する',
            expect: 'エラーが表示される',
            steps: ['/login にアクセスする', '誤った認証情報を入力する'],
            type: 'error',
          },
          {
            action: '長いメールアドレスを入力する',
            expect: 'バリデーションが表示される',
            steps: ['/login にアクセスする', '256文字を入力する'],
            type: 'boundary',
          },
        ],
      }),
    ];
    const setups = [createSetup('logged_in')];

    const result = validate(screens, setups);

    expect(result).toEqual({
      issues: [],
      hasErrors: false,
    });
  });

  it('reports duplicate screen IDs as errors', () => {
    const result = validate(
      [
        createScreen({ screen: 'home', route: '/' }),
        createScreen({ screen: 'home', route: '/duplicate', title: '重複ホーム画面' }),
      ],
      [],
    );

    expect(result.hasErrors).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          file: 'screens/home.yaml',
          field: 'screen',
          message: 'screen ID "home" が重複しています',
        }),
      ]),
    );
  });

  it('reports missing given setup references for string and string[]', () => {
    const result = validate(
      [
        createScreen({
          cases: [
            {
              action: '画面を開く',
              expect: '一覧が表示される',
              steps: ['/ にアクセスする'],
              type: 'normal',
              given: 'missing_setup',
            },
            {
              action: '復帰する',
              expect: 'エラーが表示される',
              steps: ['/ にアクセスする'],
              type: 'error',
              given: ['logged_in', 'missing_seed'],
            },
            {
              action: '100件で開く',
              expect: 'ページネーションが表示される',
              steps: ['/ にアクセスする'],
              type: 'boundary',
              given: 'logged_in',
            },
          ],
        }),
      ],
      [createSetup('logged_in')],
    );

    expect(result.hasErrors).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          field: 'cases[0].given',
          message: 'given "missing_setup" → setup が見つからない',
        }),
        expect.objectContaining({
          level: 'error',
          field: 'cases[1].given',
          message: 'given "missing_seed" → setup が見つからない',
        }),
      ]),
    );
  });

  it('reports missing navigates_to references and skips undefined values', () => {
    const result = validate(
      [
        createScreen({
          cases: [
            {
              action: 'リンクを押す',
              expect: '詳細に遷移する',
              steps: ['リンクをクリックする'],
              type: 'normal',
              navigates_to: 'missing_screen',
            },
            {
              action: 'エラーリンクを押す',
              expect: 'ログインに戻る',
              steps: ['エラーリンクをクリックする'],
              type: 'error',
              navigates_to: 'login',
            },
            {
              action: '件数境界で開く',
              expect: '一覧が表示される',
              steps: ['/ にアクセスする'],
              type: 'boundary',
            },
          ],
        }),
        createScreen({
          screen: 'login',
          route: '/login',
          title: 'ログイン画面',
        }),
      ],
      [],
    );

    expect(result.hasErrors).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          field: 'cases[0].navigates_to',
          message: 'navigates_to "missing_screen" → screen が見つからない',
        }),
      ]),
    );
    expect(
      result.issues.filter((issue) => issue.field === 'cases[2].navigates_to'),
    ).toHaveLength(0);
  });

  it('reports empty cases as a warning', () => {
    const result = validate(
      [
        createScreen({
          screen: 'empty',
          route: '/empty',
          title: '空画面',
          cases: [],
        }),
      ],
      [],
    );

    expect(result.hasErrors).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          file: 'screens/empty.yaml',
          field: 'cases',
          message: 'cases が空です',
        }),
      ]),
    );
  });

  it('reports screens without error cases as warnings', () => {
    const result = validate(
      [
        createScreen({
          cases: [
            {
              action: '画面を開く',
              expect: '一覧が表示される',
              steps: ['/ にアクセスする'],
              type: 'normal',
            },
            {
              action: '100件で開く',
              expect: 'ページネーションが表示される',
              steps: ['/ にアクセスする'],
              type: 'boundary',
            },
          ],
        }),
      ],
      [],
    );

    expect(result.hasErrors).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          message: '異常系 (type: error) が 0 件',
        }),
      ]),
    );
  });

  it('reports screens without boundary cases as warnings', () => {
    const result = validate(
      [
        createScreen({
          cases: [
            {
              action: '画面を開く',
              expect: '一覧が表示される',
              steps: ['/ にアクセスする'],
              type: 'normal',
            },
            {
              action: '不正入力を送信する',
              expect: 'エラーが表示される',
              steps: ['/ にアクセスする', '不正な値を入力する'],
              type: 'error',
            },
          ],
        }),
      ],
      [],
    );

    expect(result.hasErrors).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          message: '境界値 (type: boundary) が 0 件',
        }),
      ]),
    );
  });

  it('accumulates multiple issues without stopping early', () => {
    const result = validate(
      [
        createScreen({
          screen: 'home',
          cases: [
            {
              action: '画面を開く',
              expect: '一覧が表示される',
              steps: ['use:missing_setup', '/ にアクセスする'],
              type: 'normal',
              given: 'missing_setup',
              navigates_to: 'missing_screen',
            },
          ],
        }),
        createScreen({
          screen: 'home',
          route: '/duplicate',
          title: '重複ホーム画面',
          cases: [
            {
              action: '画面を開く',
              expect: '一覧が表示される',
              steps: ['/ にアクセスする'],
              type: 'normal',
            },
          ],
        }),
      ],
      [],
    );

    expect(result.hasErrors).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'screen ID "home" が重複しています',
        }),
        expect.objectContaining({
          message: 'given "missing_setup" → setup が見つからない',
        }),
        expect.objectContaining({
          message: 'navigates_to "missing_screen" → screen が見つからない',
        }),
        expect.objectContaining({
          message: '異常系 (type: error) が 0 件',
        }),
        expect.objectContaining({
          message: '境界値 (type: boundary) が 0 件',
        }),
      ]),
    );
    expect(result.issues.length).toBeGreaterThanOrEqual(6);
  });
});
