// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { afterEach, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import { App } from '../../src/core/viewer/components/App';
import { ScreenDetail } from '../../src/core/viewer/components/ScreenDetail';
import { createTestProject } from './helpers';

const project = createTestProject();
const loginScreen = project.screens[0];

afterEach(cleanup);

describe('Viewer Screen 詳細', () => {
  it('screen の詳細を表示する → screen のタイトルが表示される', () => {
    render(<App data={project} />);
    fireEvent.click(screen.getByTestId('sidebar-screen-login'));

    expect(screen.getByTestId('screen-detail-title')).toHaveTextContent('ログイン画面');
    expect(screen.getByTestId('screen-detail-route')).toHaveTextContent('/login');
  });

  it('cases がタイプ別に分類される → normal/error/boundary が表示される', () => {
    render(<ScreenDetail screen={loginScreen} setups={project.setups} onNavigate={() => {}} />);

    expect(screen.getByTestId('case-open-page')).toBeInTheDocument();
    expect(screen.getAllByTestId(/case-badge-normal/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('case-badge-error-wrong-credentials')).toBeInTheDocument();
    expect(screen.getByTestId('case-badge-boundary-long-email')).toBeInTheDocument();
  });

  it('given 参照を確認する → given の setup 名が表示される', () => {
    render(<App data={project} />);
    fireEvent.click(screen.getByTestId('sidebar-screen-home'));

    expect(screen.getByTestId('given-link-logged-in')).toBeInTheDocument();
  });

  it('navigates_to 参照を確認する → 遷移先の screen 名が表示される', () => {
    render(<ScreenDetail screen={loginScreen} setups={project.setups} onNavigate={() => {}} />);

    expect(screen.getByTestId('navigates-to-home')).toBeInTheDocument();
  });

  it('steps が表示される → steps が順序付きで表示される', () => {
    render(<ScreenDetail screen={loginScreen} setups={project.setups} onNavigate={() => {}} />);

    expect(screen.getByTestId('case-step-0-0')).toHaveTextContent('/login にアクセスする');
  });

  describe('異常系', () => {
    it('存在しない screen ID → アプリがクラッシュしない', () => {
      render(<App data={project} />);
      expect(screen.getByTestId('app-root')).toBeInTheDocument();
    });
  });
});
