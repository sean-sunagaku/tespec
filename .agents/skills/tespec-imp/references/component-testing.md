# Component Testing パターン

UI コンポーネントのテストを jsdom 環境で実行するための実装パターン集。

## test-id ルール

- **`getByText` は使わない。`getByTestId` を使う。**
- test-id は **全て英語** の kebab-case で命名する
- 日本語のテキストに依存しないことで、UI テキスト変更時にテストが壊れない

### 命名規則

| パターン | 例 |
|---------|---|
| サイドバー項目 | `sidebar-screen-{id}`, `sidebar-unit-{id}`, `sidebar-setup-{id}` |
| 詳細画面タイトル | `screen-detail-title`, `unit-detail-title`, `setup-detail-title` |
| 詳細画面サブ情報 | `screen-detail-route`, `setup-step-{index}` |
| case バッジ | `case-badge-{type}-{slug}` |
| given リンク | `given-link-{setup-id}` |
| navigates_to リンク | `navigates-to-{screen-id}` |
| メソッドセクション | `method-{method-name}` |
| ルート要素 | `app-root` |
| 空状態 | `empty-state` |

### コンポーネント側の実装

```tsx
// data-testid を JSX に付与する
<div data-testid={`sidebar-screen-${screen.screen}`}>{screen.screen}</div>
<h2 data-testid="screen-detail-title">{screen.title}</h2>
<span data-testid={`case-badge-${case_.type}-${slug}`}>{case_.type}</span>
```

## Preact + @testing-library/preact

### セットアップ

```bash
pnpm add preact
pnpm add -D @testing-library/preact @testing-library/jest-dom
```

テストファイル冒頭に環境指定:
```typescript
// @vitest-environment jsdom
```

### コンポーネント分離の構造

```
src/<module>/
├── components/
│   ├── App.tsx              # ルーター + 状態管理
│   ├── Dashboard.tsx        # 一覧表示
│   ├── Detail.tsx           # 詳細表示
│   └── ...
├── template.ts              # HTML シェル（<div id="root"> + バンドル JS 埋め込み）
└── server.ts                # HTTP サーバー
```

template.ts は HTML の外殻だけを返し、`<div id="root">` にバンドル済みの JS を埋め込む。
コンポーネントは独立した .tsx ファイルにすることで import してテストできる。

### テスト例: 表示確認

```typescript
// @vitest-environment jsdom
import { render, screen } from '@testing-library/preact';
import { Dashboard } from '../../src/viewer/components/Dashboard';

it('一覧が表示される', () => {
  render(<Dashboard screens={testScreens} units={testUnits} setups={testSetups} />);
  expect(screen.getByText('ログイン画面')).toBeInTheDocument();
  expect(screen.getByText('/login')).toBeInTheDocument();
});
```

### テスト例: クリックインタラクション

```typescript
import { render, screen, fireEvent } from '@testing-library/preact';
import { App } from '../../src/viewer/components/App';

it('screen クリック → 詳細表示', () => {
  render(<App data={testData} />);
  fireEvent.click(screen.getByText('login'));
  expect(screen.getByText('ログイン画面')).toBeInTheDocument();
  expect(screen.getByText('/login')).toBeInTheDocument();
});
```

### テスト例: 画面遷移（navigates_to）

```typescript
it('given リンクをクリック → setup 詳細に遷移', () => {
  render(<App data={testData} />);
  // screen 詳細に遷移
  fireEvent.click(screen.getByText('home'));
  // given のリンクをクリック
  fireEvent.click(screen.getByText('logged_in'));
  // setup 詳細が表示される
  expect(screen.getByText('ログイン済み状態')).toBeInTheDocument();
});
```

### テスト例: 空状態

```typescript
it('0件の場合 → 空メッセージ表示', () => {
  render(<Dashboard screens={[]} units={[]} setups={[]} />);
  expect(screen.getByText(/no screens/i)).toBeInTheDocument();
});
```

### テスト例: タイプ別表示（normal/error/boundary）

```typescript
it('cases がタイプ別にバッジ表示される', () => {
  render(<ScreenDetail screen={loginScreen} setups={[]} />);
  expect(screen.getAllByText('normal')).toHaveLength(2);
  expect(screen.getByText('error')).toBeInTheDocument();
  expect(screen.getByText('boundary')).toBeInTheDocument();
});
```

### 注意点

- **jsdom は CSS を解釈しない**: `display: none` 等のスタイルベースの表示/非表示はテストできない。`data-testid` や DOM 構造で検証する
- **非同期更新**: 状態更新後の DOM を待つ場合は `waitFor` を使う
- **SSE のモック**: EventSource はテスト用のモックを作成する
