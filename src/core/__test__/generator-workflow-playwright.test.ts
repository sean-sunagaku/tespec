import { describe, expect, it } from 'vitest';
import { playwright } from '../generators/workflow/playwright.js';
import type { Workflow } from '../schema.js';

describe('workflow playwright generator', () => {
  it('generates step with action and no expect', () => {
    const workflow: Workflow = {
      workflow: 'w1',
      title: 'アクションのみ',
      steps: [{ screen: 'login', action: 'ログインボタンをタップ' }],
    };

    const result = playwright.generate(workflow);
    expect(result).toContain('// Step 1: login — ログインボタンをタップ');
    expect(result).not.toContain('// expect:');
    expect(result).toContain('// TODO: implement');
  });

  it('generates step with no action and expect', () => {
    const workflow: Workflow = {
      workflow: 'w2',
      title: 'Expectのみ',
      steps: [{ screen: 'home', expect: 'ホーム画面が表示される' }],
    };

    const result = playwright.generate(workflow);
    expect(result).toContain('// Step 1: home');
    expect(result).not.toContain('// Step 1: home —');
    expect(result).toContain('// expect: ホーム画面が表示される');
    expect(result).toContain('// TODO: implement');
  });

  it('generates step with both action and expect', () => {
    const workflow: Workflow = {
      workflow: 'w3',
      title: 'アクションとExpect',
      steps: [
        {
          screen: 'signup',
          action: 'フォームを入力して送信',
          expect: '完了メッセージが表示される',
        },
      ],
    };

    const result = playwright.generate(workflow);
    expect(result).toContain('// Step 1: signup — フォームを入力して送信');
    expect(result).toContain('// expect: 完了メッセージが表示される');
    expect(result).toContain('// TODO: implement');
  });

  it('generates a 3-step workflow as a single test function', () => {
    const workflow: Workflow = {
      workflow: 'user_registration',
      title: '新規ユーザー登録フロー',
      steps: [
        { screen: 'login', action: '新規登録リンクをタップ' },
        { screen: 'signup', action: '必要事項を入力して登録' },
        { screen: 'home', expect: 'ようこそメッセージが表示される' },
      ],
    };

    expect(playwright.generate(workflow)).toMatchInlineSnapshot(`
      "import { test, expect } from "@playwright/test";

      test("新規ユーザー登録フロー", async ({ page }) => {
        // Step 1: login — 新規登録リンクをタップ
        // TODO: implement

        // Step 2: signup — 必要事項を入力して登録
        // TODO: implement

        // Step 3: home
        // expect: ようこそメッセージが表示される
        // TODO: implement

      });
      "
    `);
  });

  it('generates step with neither action nor expect', () => {
    const workflow: Workflow = {
      workflow: 'w4',
      title: 'アクションもExpectもなし',
      steps: [{ screen: 'dashboard' }],
    };

    const result = playwright.generate(workflow);
    expect(result).toContain('// Step 1: dashboard');
    expect(result).not.toContain('// Step 1: dashboard —');
    expect(result).not.toContain('// expect:');
    expect(result).toContain('// TODO: implement');
  });

  it('fileNameFor returns workflowId.spec.ts', () => {
    expect(playwright.fileNameFor('user_registration')).toBe('user_registration.spec.ts');
  });
});
