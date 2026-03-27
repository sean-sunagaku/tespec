import type { ParsedProject } from '../../src/core/parser.js';
import type { Config, Screen, Setup, UnitSpec } from '../../src/core/schema.js';

const config: Config = {
  version: 1,
  project: 'test-project',
  screens_dir: './screens',
  setups_dir: './setups',
  units_dir: './units',
};

const setups: Setup[] = [
  { setup: 'logged_in', title: 'ログイン済み状態', steps: ['テストユーザーでログイン'] },
  { setup: 'offline', title: 'オフライン状態', steps: ['ネットワークを無効化'] },
];

const screens: Screen[] = [
  {
    screen: 'login',
    route: '/login',
    title: 'ログイン画面',
    cases: [
      {
        action: '画面を開く',
        steps: ['/login にアクセスする'],
        expect: 'フォームが表示される',
        type: 'normal',
      },
      {
        action: 'ログインする',
        steps: ['認証情報を入力', '送信ボタンをクリック'],
        expect: 'ホームに遷移',
        type: 'normal',
        navigates_to: 'home',
      },
      {
        action: '誤った認証情報',
        steps: ['不正な認証情報を入力', '送信'],
        expect: 'エラー表示',
        type: 'error',
        not_expect: ['ホームに遷移する'],
      },
      {
        action: '256文字メール',
        steps: ['長いメールを入力'],
        expect: 'バリデーション表示',
        type: 'boundary',
      },
    ],
  },
  {
    screen: 'home',
    route: '/',
    title: 'ホーム画面',
    cases: [
      {
        action: '画面を開く',
        given: 'logged_in',
        steps: ['use:logged_in', '/ にアクセスする'],
        expect: '一覧が表示される',
        type: 'normal',
      },
      {
        action: 'オフラインで開く',
        given: 'offline',
        steps: ['use:offline', '/ にアクセスする'],
        expect: 'エラーが表示される',
        type: 'error',
      },
    ],
  },
];

const units: UnitSpec[] = [
  {
    unit: 'user-service',
    title: 'ユーザーサービス',
    methods: [
      {
        method: 'createUser',
        cases: [
          { action: '有効なメールで作成', expect: 'User が返る', type: 'normal' },
          { action: '重複メール', expect: 'DuplicateEmailError', type: 'error' },
        ],
      },
    ],
  },
];

export function createTestProject(): ParsedProject {
  return { config, screens, setups, units };
}

export function createEmptyProject(): ParsedProject {
  return {
    config: { ...config, units_dir: undefined },
    screens: [],
    setups: [],
    units: [],
  };
}
