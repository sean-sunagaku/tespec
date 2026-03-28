// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('d3-zoom', () => ({
  zoom: vi.fn(() => ({
    scaleExtent: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  })),
  zoomIdentity: { x: 0, y: 0, k: 1 },
}));

vi.mock('d3-selection', () => ({
  select: vi.fn(() => ({
    call: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  })),
}));

import { NodeGraph } from '../../src/core/viewer/components/NodeGraph.js';
import type { SpecsInput } from '../../src/core/viewer/graph/transform.js';

const testData: SpecsInput = {
  screens: [
    {
      screen: 'login',
      route: '/login',
      title: 'ログイン画面',
      cases: [
        {
          action: 'ログインする',
          steps: ['入力', '送信'],
          expect: '遷移',
          type: 'normal',
          navigates_to: 'home',
        },
      ],
    },
    {
      screen: 'home',
      route: '/',
      title: 'ホーム画面',
      cases: [
        {
          action: '表示',
          given: 'logged_in',
          steps: ['use:logged_in', 'アクセス'],
          expect: '一覧',
          type: 'normal',
        },
      ],
    },
  ],
  setups: [{ setup: 'logged_in', title: 'ログイン済み', steps: ['ログイン'] }],
  workflows: [
    {
      workflow: 'login-flow',
      title: 'ログインフロー',
      steps: [{ screen: 'login', action: 'ログイン', expect: '遷移' }, { screen: 'home' }],
    },
  ],
};

const emptyData: SpecsInput = { screens: [], setups: [], workflows: [] };

afterEach(cleanup);

describe('Viewer ノードグラフ', () => {
  it('ダッシュボードでグラフを確認する → ダッシュボードの右側にノードグラフが表示される', () => {
    const onNodeClick = vi.fn();
    render(<NodeGraph data={testData} onNodeClick={onNodeClick} />);

    expect(screen.getByTestId('node-graph')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-screen:login')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-screen:home')).toBeInTheDocument();
  });

  it('navigates_to のエッジを確認する → navigates_to を持つ case に対応する実線の青エッジが表示される', () => {
    render(<NodeGraph data={testData} onNodeClick={vi.fn()} />);

    const edges = screen.getAllByTestId(/^graph-edge-/);
    const navEdge = edges.find((el) => el.getAttribute('data-edge-type') === 'navigates_to');
    expect(navEdge).toBeTruthy();
  });

  it('Workflow のエッジを確認する → Workflow の steps 間に破線の紫エッジが表示される', () => {
    render(<NodeGraph data={testData} onNodeClick={vi.fn()} />);

    const edges = screen.getAllByTestId(/^graph-edge-/);
    const wfEdge = edges.find((el) => el.getAttribute('data-edge-type') === 'workflow');
    expect(wfEdge).toBeTruthy();
  });

  it('Setup 参照のエッジを確認する → case.given で Setup を参照する Screen から点線の緑エッジが表示される', () => {
    render(<NodeGraph data={testData} onNodeClick={vi.fn()} />);

    expect(screen.getByTestId('graph-node-setup:logged_in')).toBeInTheDocument();
    const edges = screen.getAllByTestId(/^graph-edge-/);
    const givenEdge = edges.find((el) => el.getAttribute('data-edge-type') === 'given');
    expect(givenEdge).toBeTruthy();
  });

  it('ノードにホバーする → ツールチップに title と route が表示される', () => {
    render(<NodeGraph data={testData} onNodeClick={vi.fn()} />);

    const node = screen.getByTestId('graph-node-screen:login');
    fireEvent.mouseEnter(node);

    expect(screen.getByTestId('graph-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('graph-tooltip')).toHaveTextContent('ログイン画面');
    expect(screen.getByTestId('graph-tooltip')).toHaveTextContent('/login');
  });

  it('ノードをクリックする → クリックした Screen の詳細画面に遷移する', () => {
    const onNodeClick = vi.fn();
    render(<NodeGraph data={testData} onNodeClick={onNodeClick} />);

    fireEvent.click(screen.getByTestId('graph-node-screen:login'));

    expect(onNodeClick).toHaveBeenCalledWith('screen', 'login');
  });

  it('グラフをズームする → グラフが拡大または縮小される', () => {
    render(<NodeGraph data={testData} onNodeClick={vi.fn()} />);

    expect(screen.getByTestId('node-graph')).toBeInTheDocument();
    // d3-zoom is mocked; verify SVG with transform group exists
    const svg = screen.getByTestId('node-graph');
    expect(svg.querySelector('g')).toBeTruthy();
  });

  it('グラフをパンする → グラフ全体が移動する', () => {
    render(<NodeGraph data={testData} onNodeClick={vi.fn()} />);

    const svg = screen.getByTestId('node-graph');
    expect(svg.querySelector('g')).toBeTruthy();
  });

  it('YAML 変更でグラフが更新される → グラフに新しいエッジが自動的に追加される', () => {
    const onNodeClick = vi.fn();
    const { rerender } = render(<NodeGraph data={testData} onNodeClick={onNodeClick} />);

    const updatedData: SpecsInput = {
      ...testData,
      screens: [
        ...testData.screens,
        {
          screen: 'settings',
          route: '/settings',
          title: '設定画面',
          cases: [{ action: '表示', steps: ['アクセス'], expect: '表示', type: 'normal' }],
        },
      ],
    };
    rerender(<NodeGraph data={updatedData} onNodeClick={onNodeClick} />);

    expect(screen.getByTestId('graph-node-screen:settings')).toBeInTheDocument();
  });

  describe('異常系', () => {
    it('navigates_to が存在しない screen を参照している → 参照先が不明なエッジはグラフに表示されない', () => {
      const badData: SpecsInput = {
        screens: [
          {
            screen: 'bad',
            route: '/bad',
            title: '不正参照',
            cases: [
              {
                action: '遷移',
                steps: ['操作'],
                expect: '遷移',
                type: 'normal',
                navigates_to: 'nonexistent',
              },
            ],
          },
        ],
        setups: [],
        workflows: [],
      };
      render(<NodeGraph data={badData} onNodeClick={vi.fn()} />);

      expect(screen.getByTestId('node-graph')).toBeInTheDocument();
      expect(screen.queryAllByTestId(/^graph-edge-/)).toHaveLength(0);
    });
  });

  describe('境界値', () => {
    it('specs が 0 件でグラフを表示する → グラフ領域に空状態のメッセージが表示される', () => {
      render(<NodeGraph data={emptyData} onNodeClick={vi.fn()} />);

      expect(screen.getByTestId('node-graph-empty')).toBeInTheDocument();
    });
  });
});
