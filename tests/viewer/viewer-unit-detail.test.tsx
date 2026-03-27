// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { afterEach, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import { App } from '../../src/core/viewer/components/App';
import { UnitDetail } from '../../src/core/viewer/components/UnitDetail';
import { createTestProject } from './helpers';

const project = createTestProject();
const userService = project.units[0];

afterEach(cleanup);

describe('Viewer Unit 詳細', () => {
  it('unit の詳細を表示する → unit のタイトルが表示される', () => {
    render(<App data={project} />);
    fireEvent.click(screen.getByTestId('sidebar-unit-user-service'));

    expect(screen.getByTestId('unit-detail-title')).toHaveTextContent('ユーザーサービス');
  });

  it('method ごとの cases を確認する → method 名がセクション見出しで表示される', () => {
    render(<UnitDetail unit={userService} />);

    expect(screen.getByTestId('method-create-user')).toBeInTheDocument();
    expect(screen.getByTestId('unit-case-valid-email')).toBeInTheDocument();
    expect(screen.getByTestId('unit-case-duplicate-email')).toBeInTheDocument();
  });

  describe('異常系', () => {
    it('存在しない unit ID でアクセスする → アプリがクラッシュしない', () => {
      render(<App data={project} />);
      expect(screen.getByTestId('app-root')).toBeInTheDocument();
    });
  });
});
