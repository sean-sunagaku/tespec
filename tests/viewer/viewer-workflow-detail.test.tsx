// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

import { App } from '../../src/core/viewer/components/App';
import { WorkflowDetail } from '../../src/core/viewer/components/WorkflowDetail';
import { createTestProject } from './helpers';

const project = createTestProject();
const workflow = project.workflows[0];

afterEach(cleanup);

describe('Viewer Workflow 詳細', () => {
  it('ダッシュボードにワークフローが表示される → サイドバーに workflow 一覧が表示される', () => {
    render(<App data={project} />);

    expect(screen.getByTestId('sidebar-workflow-user_registration')).toBeInTheDocument();
  });

  it('workflow を選択する → workflow の詳細がメインエリアに表示される', () => {
    render(<App data={project} />);
    fireEvent.click(screen.getByTestId('sidebar-workflow-user_registration'));

    expect(screen.getByTestId('workflow-detail-title')).toHaveTextContent('新規ユーザー登録フロー');
  });

  it('workflow のタイトルが表示される', () => {
    render(<WorkflowDetail workflow={workflow} onNavigate={() => {}} />);

    expect(screen.getByTestId('workflow-detail-title')).toHaveTextContent('新規ユーザー登録フロー');
  });

  it('全ステップがカード形式で表示される', () => {
    render(<WorkflowDetail workflow={workflow} onNavigate={() => {}} />);

    expect(screen.getByTestId('workflow-step-0')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-step-1')).toBeInTheDocument();
  });

  it('ステップの screen ID が表示される', () => {
    render(<WorkflowDetail workflow={workflow} onNavigate={() => {}} />);

    expect(screen.getByTestId('workflow-step-0')).toHaveTextContent('login');
    expect(screen.getByTestId('workflow-step-1')).toHaveTextContent('home');
  });

  it('action がある場合に表示される', () => {
    render(<WorkflowDetail workflow={workflow} onNavigate={() => {}} />);

    expect(screen.getByTestId('workflow-step-0')).toHaveTextContent('新規登録リンクをタップ');
  });

  it('expect がある場合に表示される', () => {
    render(<WorkflowDetail workflow={workflow} onNavigate={() => {}} />);

    expect(screen.getByTestId('workflow-step-1')).toHaveTextContent('ホーム画面が表示される');
  });

  it('screen ID をクリックすると画面詳細に遷移する', () => {
    const onNavigate = vi.fn();
    render(<WorkflowDetail workflow={workflow} onNavigate={onNavigate} />);

    const screenLink = screen.getByTestId('workflow-step-0').querySelector('[role="button"]');
    fireEvent.click(screenLink!);

    expect(onNavigate).toHaveBeenCalledWith('screen', 'login');
  });

  describe('境界値', () => {
    it('action も expect もないステップが表示される', () => {
      const minimalWorkflow = {
        workflow: 'minimal',
        title: 'ミニマルフロー',
        steps: [{ screen: 'login' }],
      };
      render(<WorkflowDetail workflow={minimalWorkflow} onNavigate={() => {}} />);

      expect(screen.getByTestId('workflow-step-0')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-step-0')).toHaveTextContent('login');
    });
  });
});
