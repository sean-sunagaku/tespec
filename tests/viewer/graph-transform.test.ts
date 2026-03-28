import { describe, expect, it } from 'vitest';

import type { Screen, Setup, Workflow } from '../../src/core/schema.js';
import { type SpecsInput, specsToGraph } from '../../src/core/viewer/graph/transform.js';

const screenLogin: Screen = {
  screen: 'login',
  route: '/login',
  title: 'ログイン画面',
  cases: [
    {
      action: 'ログインする',
      steps: ['認証情報を入力', '送信'],
      expect: 'ホームに遷移',
      type: 'normal',
      navigates_to: 'home',
    },
    {
      action: '新規登録へ',
      steps: ['新規登録リンクをクリック'],
      expect: '登録画面に遷移',
      type: 'normal',
      navigates_to: 'register',
    },
  ],
};

const screenHome: Screen = {
  screen: 'home',
  route: '/',
  title: 'ホーム画面',
  cases: [
    {
      action: 'ダッシュボード表示',
      given: 'logged_in',
      steps: ['use:logged_in', '/ にアクセスする'],
      expect: '一覧が表示される',
      type: 'normal',
    },
  ],
};

const screenRegister: Screen = {
  screen: 'register',
  route: '/register',
  title: '登録画面',
  cases: [
    {
      action: '登録する',
      given: ['logged_out', 'terms_accepted'],
      steps: ['フォーム入力', '送信'],
      expect: '登録完了',
      type: 'normal',
    },
  ],
};

const setupLoggedIn: Setup = {
  setup: 'logged_in',
  title: 'ログイン済み',
  steps: ['テストユーザーでログイン'],
};
const setupLoggedOut: Setup = { setup: 'logged_out', title: '未ログイン', steps: ['ログアウト'] };
const setupTerms: Setup = {
  setup: 'terms_accepted',
  title: '利用規約同意済み',
  steps: ['利用規約に同意'],
};

const workflow1: Workflow = {
  workflow: 'registration-flow',
  title: '新規登録フロー',
  steps: [
    { screen: 'login', action: '新規登録リンクをクリック', expect: '登録画面に遷移' },
    { screen: 'register', action: 'フォームを入力して送信', expect: '登録完了' },
    { screen: 'home' },
  ],
};

describe('グラフデータ変換', () => {
  describe('specsToGraph', () => {
    it('Screen のみの SpecsInput を変換する → 各 Screen に対応する GraphNode が生成される', () => {
      const input: SpecsInput = { screens: [screenLogin, screenHome], setups: [], workflows: [] };
      const result = specsToGraph(input);

      const screenNodes = result.nodes.filter((n) => n.type === 'screen');
      expect(screenNodes).toHaveLength(2);
      expect(screenNodes[0]).toMatchObject({
        id: 'screen:login',
        type: 'screen',
        label: 'ログイン画面',
        sublabel: '/login',
      });
      expect(screenNodes[1]).toMatchObject({
        id: 'screen:home',
        type: 'screen',
        label: 'ホーム画面',
        sublabel: '/',
      });
    });

    it('Setup のみの SpecsInput を変換する → 各 Setup に対応する GraphNode が生成される', () => {
      const input: SpecsInput = { screens: [], setups: [setupLoggedIn], workflows: [] };
      const result = specsToGraph(input);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toMatchObject({
        id: 'setup:logged_in',
        type: 'setup',
        label: 'ログイン済み',
      });
    });

    it('navigates_to を持つ case がある Screen を変換する → navigates_to に対応する GraphEdge が生成される', () => {
      const input: SpecsInput = { screens: [screenLogin, screenHome], setups: [], workflows: [] };
      const result = specsToGraph(input);

      const navEdges = result.edges.filter((e) => e.type === 'navigates_to');
      expect(navEdges.length).toBeGreaterThanOrEqual(1);
      expect(navEdges[0]).toMatchObject({
        source: 'screen:login',
        target: 'screen:home',
        type: 'navigates_to',
      });
      expect(navEdges[0].label).toContain('ログインする');
    });

    it('Workflow の steps を変換する → 連続する steps 間に GraphEdge が生成される', () => {
      const input: SpecsInput = {
        screens: [screenLogin, screenHome, screenRegister],
        setups: [],
        workflows: [workflow1],
      };
      const result = specsToGraph(input);

      const wfEdges = result.edges.filter((e) => e.type === 'workflow');
      expect(wfEdges).toHaveLength(2);
      expect(wfEdges[0]).toMatchObject({
        source: 'screen:login',
        target: 'screen:register',
        type: 'workflow',
      });
      expect(wfEdges[1]).toMatchObject({
        source: 'screen:register',
        target: 'screen:home',
        type: 'workflow',
      });
    });

    it('case.given で setup を参照している Screen を変換する → Screen から Setup への GraphEdge が生成される', () => {
      const input: SpecsInput = { screens: [screenHome], setups: [setupLoggedIn], workflows: [] };
      const result = specsToGraph(input);

      const givenEdges = result.edges.filter((e) => e.type === 'given');
      expect(givenEdges).toHaveLength(1);
      expect(givenEdges[0]).toMatchObject({
        source: 'screen:home',
        target: 'setup:logged_in',
        type: 'given',
      });
    });

    it('given が配列の場合に変換する → 配列の各要素に対応する GraphEdge が生成される', () => {
      const input: SpecsInput = {
        screens: [screenRegister],
        setups: [setupLoggedOut, setupTerms],
        workflows: [],
      };
      const result = specsToGraph(input);

      const givenEdges = result.edges.filter((e) => e.type === 'given');
      expect(givenEdges).toHaveLength(2);
      expect(givenEdges.map((e) => e.target)).toContain('setup:logged_out');
      expect(givenEdges.map((e) => e.target)).toContain('setup:terms_accepted');
    });

    describe('異常系', () => {
      it('navigates_to が存在しない screen ID を参照している場合 → 参照先が不明なエッジはスキップされる', () => {
        const badScreen: Screen = {
          screen: 'bad',
          route: '/bad',
          title: '不正',
          cases: [
            {
              action: '遷移',
              steps: ['操作'],
              expect: '遷移',
              type: 'normal',
              navigates_to: 'nonexistent',
            },
          ],
        };
        const input: SpecsInput = { screens: [badScreen], setups: [], workflows: [] };
        const result = specsToGraph(input);

        expect(result.edges.filter((e) => e.type === 'navigates_to')).toHaveLength(0);
      });
    });

    describe('境界値', () => {
      it('空の SpecsInput を変換する → nodes が空配列で返る', () => {
        const input: SpecsInput = { screens: [], setups: [], workflows: [] };
        const result = specsToGraph(input);

        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
      });

      it('同一 source-target-type のエッジが複数ある場合 → 重複エッジのラベルが結合される', () => {
        const multiNav: Screen = {
          screen: 'multi',
          route: '/multi',
          title: 'マルチ遷移',
          cases: [
            {
              action: '操作A',
              steps: ['操作A'],
              expect: '遷移',
              type: 'normal',
              navigates_to: 'home',
            },
            {
              action: '操作B',
              steps: ['操作B'],
              expect: '遷移',
              type: 'normal',
              navigates_to: 'home',
            },
          ],
        };
        const input: SpecsInput = { screens: [multiNav, screenHome], setups: [], workflows: [] };
        const result = specsToGraph(input);

        const navEdges = result.edges.filter(
          (e) => e.type === 'navigates_to' && e.source === 'screen:multi',
        );
        expect(navEdges).toHaveLength(1);
        expect(navEdges[0].label).toContain('操作A');
        expect(navEdges[0].label).toContain('操作B');
      });
    });
  });
});
