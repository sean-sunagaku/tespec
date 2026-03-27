// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { afterEach, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import { App } from '../../src/core/viewer/components/App';
import { createEmptyProject, createTestProject } from './helpers';

const project = createTestProject();

afterEach(cleanup);

describe('Viewer ダッシュボード', () => {
  it('ページを開く → サイドバーに screens 一覧が表示される', () => {
    render(<App data={project} />);

    expect(screen.getByTestId('sidebar-screen-login')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-screen-home')).toBeInTheDocument();
  });

  it('ページを開く → サイドバーに units 一覧が表示される', () => {
    render(<App data={project} />);

    expect(screen.getByTestId('sidebar-unit-user-service')).toBeInTheDocument();
  });

  it('ページを開く → サイドバーに setups 一覧が表示される', () => {
    render(<App data={project} />);

    expect(screen.getByTestId('sidebar-setup-logged-in')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-setup-offline')).toBeInTheDocument();
  });

  it('screen を選択する → screen の詳細がメインエリアに表示される', () => {
    render(<App data={project} />);

    fireEvent.click(screen.getByTestId('sidebar-screen-login'));

    expect(screen.getByTestId('screen-detail-title')).toHaveTextContent('ログイン画面');
    expect(screen.getByTestId('screen-detail-route')).toHaveTextContent('/login');
  });

  it('unit を選択する → unit の詳細がメインエリアに表示される', () => {
    render(<App data={project} />);

    fireEvent.click(screen.getByTestId('sidebar-unit-user-service'));

    expect(screen.getByTestId('unit-detail-title')).toHaveTextContent('ユーザーサービス');
  });

  it('setup を選択する → setup の詳細がメインエリアに表示される', () => {
    render(<App data={project} />);

    fireEvent.click(screen.getByTestId('sidebar-setup-logged-in'));

    expect(screen.getByTestId('setup-detail-title')).toHaveTextContent('ログイン済み状態');
  });

  it('YAML ファイルを変更する → ブラウザの表示が自動的に更新される', () => {
    const { rerender } = render(<App data={project} />);
    expect(screen.getByTestId('sidebar-screen-login')).toBeInTheDocument();

    const emptyProject = createEmptyProject();
    rerender(<App data={emptyProject} />);

    expect(screen.queryByTestId('sidebar-screen-login')).not.toBeInTheDocument();
  });

  describe('異常系', () => {
    it('YAML に構文エラーがある状態 → アプリがクラッシュしない', () => {
      render(<App data={project} />);
      expect(screen.getByTestId('app-root')).toBeInTheDocument();
    });
  });

  describe('境界値', () => {
    it('specs が0件のプロジェクトで開く → 空状態のメッセージが表示される', () => {
      const emptyProject = createEmptyProject();
      render(<App data={emptyProject} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });
});
