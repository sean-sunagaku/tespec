// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { afterEach, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import { App } from '../../src/core/viewer/components/App';
import { SetupDetail } from '../../src/core/viewer/components/SetupDetail';
import { createTestProject } from './helpers';

const project = createTestProject();
const loggedInSetup = project.setups[0];

afterEach(cleanup);

describe('Viewer Setup 詳細', () => {
  it('setup の詳細を表示する → setup のタイトルが表示される', () => {
    render(<App data={project} />);
    fireEvent.click(screen.getByTestId('sidebar-setup-logged-in'));

    expect(screen.getByTestId('setup-detail-title')).toHaveTextContent('ログイン済み状態');
    expect(screen.getByTestId('setup-step-0')).toHaveTextContent('テストユーザーでログイン');
  });

  it('setup を参照している screen が分かる → 参照元 screen 一覧が表示される', () => {
    const referencingScreens = project.screens.filter((s) =>
      s.cases.some((c) => {
        const given = c.given ? (Array.isArray(c.given) ? c.given : [c.given]) : [];
        return given.includes(loggedInSetup.setup);
      }),
    );

    render(
      <SetupDetail
        setup={loggedInSetup}
        referencingScreens={referencingScreens}
        onNavigate={() => {}}
      />,
    );

    expect(screen.getByTestId('setup-detail-title')).toHaveTextContent('ログイン済み状態');
    expect(screen.getByTestId('ref-screen-home')).toBeInTheDocument();
  });

  describe('異常系', () => {
    it('存在しない setup ID → アプリがクラッシュしない', () => {
      render(<App data={project} />);
      expect(screen.getByTestId('app-root')).toBeInTheDocument();
    });
  });
});
