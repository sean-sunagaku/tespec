import { describe, expect, it } from 'vitest';

import type { Screen, Workflow } from '../schema.js';
import { validateWorkflows } from '../workflow-validator.js';

function createScreen(overrides: Partial<Screen> = {}): Screen {
  return {
    screen: 'home',
    route: '/',
    title: 'ホーム画面',
    cases: [
      {
        action: '画面を開く',
        expect: '一覧が表示される',
        steps: ['/ にアクセスする'],
        type: 'normal',
      },
    ],
    ...overrides,
  };
}

function createWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    workflow: 'login-flow',
    title: 'ログインフロー',
    steps: [
      {
        screen: 'home',
        action: 'ログインボタンを押す',
        expect: 'ログイン画面に遷移する',
      },
      {
        screen: 'login',
        action: '認証情報を入力して送信する',
        expect: 'ダッシュボードに遷移する',
      },
    ],
    ...overrides,
  };
}

describe('validateWorkflows', () => {
  it('returns no issues for valid workflows', () => {
    const screens = [
      createScreen(),
      createScreen({ screen: 'login', route: '/login', title: 'ログイン画面' }),
    ];
    const workflows = [createWorkflow()];

    const result = validateWorkflows(workflows, screens);

    expect(result).toEqual({
      issues: [],
      hasErrors: false,
    });
  });

  it('reports duplicate workflow IDs as errors', () => {
    const screens = [createScreen()];
    const workflows = [
      createWorkflow({
        steps: [{ screen: 'home', action: 'アクション1', expect: '期待1' }],
      }),
      createWorkflow({
        title: '重複ログインフロー',
        steps: [{ screen: 'home', action: 'アクション2', expect: '期待2' }],
      }),
    ];

    const result = validateWorkflows(workflows, screens);

    expect(result.hasErrors).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          file: 'workflows/login-flow.yaml',
          field: 'workflow',
          message: 'workflow ID "login-flow" が重複しています',
        }),
      ]),
    );
  });

  it('reports missing screen references as errors', () => {
    const screens = [createScreen()];
    const workflows = [
      createWorkflow({
        steps: [
          { screen: 'home', action: 'アクション', expect: '期待' },
          { screen: 'missing-screen', action: 'アクション', expect: '期待' },
        ],
      }),
    ];

    const result = validateWorkflows(workflows, screens);

    expect(result.hasErrors).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          file: 'workflows/login-flow.yaml',
          field: 'steps[1].screen',
          message: 'screen "missing-screen" が見つからない',
        }),
      ]),
    );
  });

  it('accumulates multiple errors', () => {
    const screens = [createScreen()];
    const workflows = [
      createWorkflow({
        workflow: 'flow-a',
        steps: [{ screen: 'no-such-screen', action: 'アクション', expect: '期待' }],
      }),
      createWorkflow({
        workflow: 'flow-a',
        title: '重複フロー',
        steps: [{ screen: 'also-missing', action: 'アクション', expect: '期待' }],
      }),
    ];

    const result = validateWorkflows(workflows, screens);

    expect(result.hasErrors).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'workflow ID "flow-a" が重複しています',
        }),
        expect.objectContaining({
          message: 'screen "no-such-screen" が見つからない',
        }),
        expect.objectContaining({
          message: 'screen "also-missing" が見つからない',
        }),
      ]),
    );
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it('reports all steps without action/expect as a warning', () => {
    const screens = [createScreen()];
    const workflows = [
      createWorkflow({
        steps: [
          { screen: 'home' },
          { screen: 'home' },
        ],
      }),
    ];

    const result = validateWorkflows(workflows, screens);

    expect(result.hasErrors).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          file: 'workflows/login-flow.yaml',
          field: 'steps',
          message: '全ステップが action/expect 未記述です',
        }),
      ]),
    );
  });

  it('returns no issues for empty workflows array', () => {
    const result = validateWorkflows([], [createScreen()]);

    expect(result).toEqual({
      issues: [],
      hasErrors: false,
    });
  });
});
