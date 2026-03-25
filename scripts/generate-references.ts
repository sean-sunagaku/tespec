import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { toJSONSchema } from 'zod';

import { CaseSchema, ScreenSchema, SetupSchema } from '../src/core/schema.js';

type JsonSchema = {
  additionalProperties?: boolean;
  anyOf?: JsonSchema[];
  default?: unknown;
  enum?: unknown[];
  items?: JsonSchema;
  minItems?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string | string[];
};

type SchemaDoc = {
  descriptions: Record<string, string>;
  fileName: string;
  example: string;
  schema: typeof CaseSchema | typeof ScreenSchema | typeof SetupSchema;
  summary: string;
  tips: string[];
  title: string;
};

const skillDir = path.resolve('skills/tespec-yaml-gen');
const rulesDir = path.join(skillDir, 'rules');
const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8')) as {
  version: string;
};
const packageVersion = packageJson.version;

const schemaDocs: SchemaDoc[] = [
  {
    fileName: 'case-schema.md',
    title: 'Case Schema',
    summary: 'Screen 内の 1 テストケースを表します。',
    schema: CaseSchema,
    example: `action: 誤った認証情報で送信する
expect:
  - エラーメッセージが表示される
  - ログインに失敗する
steps:
  - use:logged_in
  - /login にアクセスする
  - 誤ったメールアドレスを入力する
  - 誤ったパスワードを入力する
  - 送信ボタンをクリックする
given: logged_in
target: ログインフォーム
type: error
not_expect:
  - ダッシュボードへ遷移する
navigates_to: login`,
    descriptions: {
      action:
        'テストケースで何をするのかを短い自然文で書きます。生成されるテスト名の前半になります。',
      expect:
        '主要な期待結果を書きます。1 つだけなら string、複数の期待結果を列挙したいときは string[] を使います。',
      steps:
        'テスト実行手順を順番どおりに並べます。最低 1 件必要で、`use:<setup_id>` は setup 呼び出しとして扱われます。',
      given:
        '事前条件として必要な setup ID を書きます。複数条件が必要なら配列にします。テスト名の prefix にも使われます。',
      target:
        '主に操作対象の UI 要素や領域を書きます。必須ではありませんが、ケースの意図が読みやすくなります。',
      type: 'ケースの分類です。通常系は `normal`、異常系は `error`、境界値ケースは `boundary` を使います。未指定時は `normal` です。',
      not_expect:
        '起きてほしくない結果を書きます。生成されるスケルトン内の補助コメントとして使えます。',
      navigates_to: '遷移後に表示される screen ID を指定します。既存の `screen` 値と一致させます。',
    },
    tips: [
      '`action` と `expect` はテスト名に近い粒度で簡潔に書く。',
      '`steps` は人が読んで実装順を迷わない並びにする。',
      '`type: error` と `type: boundary` を最低 1 件ずつ持たせると warning を避けやすい。',
    ],
  },
  {
    fileName: 'screen-schema.md',
    title: 'Screen Schema',
    summary: 'screens/*.yaml の 1 画面定義を表します。',
    schema: ScreenSchema,
    example: `screen: login
route: /login
title: ログイン画面
cases:
  - action: 正しい認証情報で送信する
    expect: ダッシュボードへ遷移する
    steps:
      - /login にアクセスする
      - 正しいメールアドレスを入力する
      - 正しいパスワードを入力する
      - 送信ボタンをクリックする
    type: normal
    navigates_to: dashboard`,
    descriptions: {
      screen:
        '画面を識別する一意 ID です。`navigates_to` の参照先として使われるので、短く安定した名前にします。',
      route:
        'その画面を開く URL やルートパスを書きます。手動ステップやナビゲーション説明の基準になります。',
      title: '人が読む画面名です。生成される `test.describe()` のタイトルとして使われます。',
      cases: 'その画面で確認したい操作と期待結果の一覧です。各要素は `Case Schema` に従います。',
      'cases[].action': 'ケースごとの操作名です。何をするケースかが一目で分かるように書きます。',
      'cases[].expect': 'ケースの主要な期待結果です。複数あるなら配列にします。',
      'cases[].steps': 'ケースを再現する具体的な手順です。1 件以上必須です。',
      'cases[].given': 'ケース開始前に満たしておきたい setup 条件です。',
      'cases[].target': 'その操作が向く UI 要素や機能名です。',
      'cases[].type': '正常系・異常系・境界値のどれかを表します。',
      'cases[].not_expect': '期待しない結果や回避したい振る舞いです。',
      'cases[].navigates_to': '遷移先の screen ID です。',
    },
    tips: [
      '`screen` は snake_case や kebab-case のような安定した ID にする。',
      '`title` は実際の画面名に寄せて、日本語のままでも問題ない。',
      '`cases` は正常系だけでなく異常系と境界値も混ぜる。',
    ],
  },
  {
    fileName: 'setup-schema.md',
    title: 'Setup Schema',
    summary: 'setups/*.yaml の 1 setup 定義を表します。',
    schema: SetupSchema,
    example: `setup: logged_in
title: ログイン済み状態
steps:
  - テストユーザーでログインする
  - ダッシュボードが表示されることを確認する`,
    descriptions: {
      setup:
        'setup を識別する一意 ID です。`given` や `use:<setup_id>` から参照されるため、用途が分かる短い名前にします。',
      title: '人が読む setup 名です。生成されるコメントや説明文に使われます。',
      steps:
        'その setup を成立させるための共通手順です。空配列は許可されますが、通常は少なくとも 1 手順書きます。',
    },
    tips: [
      '`setup` は状態名ベースで付けると再利用しやすい。',
      '`steps` は他の screen でも使える共通前提だけを入れる。',
    ],
  },
];

await mkdir(rulesDir, { recursive: true });

for (const doc of schemaDocs) {
  const jsonSchema = toJSONSchema(doc.schema) as JsonSchema;
  const markdown = renderSchemaMarkdown(doc, jsonSchema);
  await writeFile(path.join(rulesDir, doc.fileName), markdown, 'utf8');
}

await writeFile(path.join(rulesDir, 'validation-rules.md'), renderValidationRules(), 'utf8');
await writeFile(path.join(rulesDir, 'writing-guide.md'), renderWritingGuide(), 'utf8');
await writeFile(path.join(skillDir, 'SKILL.md'), renderSkillMarkdown(), 'utf8');

function renderSchemaMarkdown(doc: SchemaDoc, schema: JsonSchema): string {
  const fieldLines = flattenFields(schema, doc.descriptions);

  return [
    `# ${doc.title}`,
    '',
    `> Generated from \`src/core/schema.ts\` by \`scripts/generate-references.ts\` for tespec v${packageVersion}.`,
    '',
    doc.summary,
    '',
    '## YAML Example',
    '```yaml',
    doc.example,
    '```',
    '',
    '## Root Rules',
    `- Type: \`${describeSchema(schema)}\``,
    `- Additional properties: \`${schema.additionalProperties === false ? 'not allowed' : 'allowed'}\``,
    '',
    '## Field Guide',
    ...fieldLines,
    '',
    '## Writing Tips',
    ...doc.tips.map((tip) => `- ${tip}`),
    '',
  ].join('\n');
}

function renderSkillMarkdown(): string {
  return [
    '---',
    'name: tespec-yaml-gen',
    'description: tespec YAML を AI が正しい形式で生成し、適切なコマンドで検証するためのスキル',
    '---',
    '',
    '# tespec-yaml-gen',
    '',
    `> Generated by \`scripts/generate-references.ts\` for tespec v${packageVersion}.`,
    '',
    '## Overview',
    '',
    '`tespec` は、YAML で画面仕様を定義し、Playwright テストスケルトンを生成する CLI です。',
    '',
    'この skill は、変わりやすいガイドを `rules/` 配下の generated docs に寄せています。まず次のドキュメントを見てください。',
    '',
    '- `rules/writing-guide.md`',
    '- `rules/screen-schema.md`',
    '- `rules/case-schema.md`',
    '- `rules/setup-schema.md`',
    '- `rules/validation-rules.md`',
    '',
    '## File Layout',
    '',
    '```text',
    'docs/tespec/',
    '├── config.yaml',
    '├── screens/',
    '│   └── <screen>.yaml',
    '└── setups/',
    '    └── <setup>.yaml',
    '```',
    '',
    '## Quick Flow',
    '',
    '1. `rules/writing-guide.md` で YAML の書き方と命名方針を確認する。',
    '2. `rules/screen-schema.md` / `rules/setup-schema.md` で必須フィールドを埋める。',
    '3. case を書くときは `rules/case-schema.md` を見る。',
    '4. 単体確認は `tespec validate --file <path>` を使う。',
    '5. 参照整合性まで確認するなら `tespec validate --config <path-to-config.yaml>` を使う。',
    '',
    '## Generated References',
    '',
    '- `rules/writing-guide.md`: 命名方針、YAML の書き方、`use:<setup_id>` の扱い',
    '- `rules/screen-schema.md`: screen YAML の例と field guide',
    '- `rules/case-schema.md`: case YAML の例と field guide',
    '- `rules/setup-schema.md`: setup YAML の例と field guide',
    '- `rules/validation-rules.md`: validate コマンド、参照整合性、warning 条件',
    '',
    '## Validation Guidance',
    '',
    '- `validate --file` は構文と schema の確認に向いています。',
    '- `validate --config` は `given` / `use:` / `navigates_to` の参照チェックも行います。',
    '- warning だけなら exit code は 0、error があると exit code は 1 になります。',
    '',
  ].join('\n');
}

function renderWritingGuide(): string {
  return [
    '# Writing Guide',
    '',
    `> Generated from authoring conventions for tespec v${packageVersion}.`,
    '',
    '## ID and Naming',
    '- `screen` / `setup` は参照される ID なので、自然文ではなく安定した識別子にする。',
    '- ID は短く、意味が分かり、将来変更しにくい名前にする。',
    '- `title` は人が読む表示名にする。生成される describe やコメントにも使われる。',
    '',
    '## Case Writing',
    '- `action` は短く、テスト名として読める粒度で書く。',
    '- `expect` は検証したい結果をそのまま書く。複数あるなら配列にする。',
    '- `target` は必須ではないが、どこを操作するケースかを明確にしたいときに使う。',
    '',
    '## Steps and Reuse',
    '- `steps` は実行順どおりに書く。',
    '- 共通前提は `use:<setup_id>` に寄せると再利用しやすい。',
    '- setup 側の `steps` には、複数 screen で使う共通前提だけを入れる。',
    '',
    '## References',
    '- `given` は事前条件として必要な setup ID を表す。',
    '- `navigates_to` は遷移先 screen ID を表す。',
    '- `use:<setup_id>` と `given` は既存の setup ID に一致する必要がある。',
    '',
    '## Example Patterns',
    '',
    '### Screen',
    '```yaml',
    'screen: login',
    'route: /login',
    'title: ログイン画面',
    'cases:',
    '  - action: 正しい認証情報で送信する',
    '    expect: ダッシュボードへ遷移する',
    '    steps:',
    '      - /login にアクセスする',
    '      - 正しいメールアドレスを入力する',
    '      - 正しいパスワードを入力する',
    '      - 送信ボタンをクリックする',
    '    type: normal',
    '    navigates_to: dashboard',
    '```',
    '',
    '### Setup',
    '```yaml',
    'setup: logged_in',
    'title: ログイン済み状態',
    'steps:',
    '  - テストユーザーでログインする',
    '  - ダッシュボードが表示されることを確認する',
    '```',
    '',
    '## When to Validate',
    '- 単体の YAML を素早く確かめたいときは `tespec validate --file <path>` を使う。',
    '- 参照整合性まで含めて確認したいときは `tespec validate --config <path>` を使う。',
    '',
  ].join('\n');
}

function flattenFields(
  schema: JsonSchema,
  descriptions: Record<string, string>,
  pathPrefix = '',
): string[] {
  const required = new Set(schema.required ?? []);
  const lines: string[] = [];

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties ?? {})) {
    const pathName = pathPrefix ? `${pathPrefix}.${fieldName}` : fieldName;
    const requiredText = required.has(fieldName) ? 'required' : 'optional';
    lines.push(`- \`${pathName}\` (${requiredText}): \`${describeSchema(fieldSchema)}\``);

    const description = descriptions[pathName];
    if (description) {
      lines.push(`  - Description: ${description}`);
    }

    if (fieldSchema.default !== undefined) {
      lines.push(`  - Default: \`${JSON.stringify(fieldSchema.default)}\``);
    }

    if (typeof fieldSchema.minItems === 'number') {
      lines.push(`  - Constraint: array length must be at least \`${fieldSchema.minItems}\`.`);
    }

    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      lines.push(...flattenFields(fieldSchema, descriptions, pathName));
    }

    if (fieldSchema.type === 'array' && fieldSchema.items?.type === 'object') {
      lines.push(...flattenFields(fieldSchema.items, descriptions, `${pathName}[]`));
    }
  }

  return lines;
}

function describeSchema(schema: JsonSchema): string {
  if (schema.enum?.length) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  }

  if (schema.anyOf?.length) {
    return schema.anyOf.map((item) => describeSchema(item)).join(' | ');
  }

  if (schema.type === 'array') {
    return `array<${describeSchema(schema.items ?? {})}>`;
  }

  if (Array.isArray(schema.type)) {
    return schema.type.join(' | ');
  }

  return schema.type ?? 'unknown';
}

function renderValidationRules(): string {
  return [
    '# Validation Rules',
    '',
    `> Generated from repository validation behavior and schema contracts for tespec v${packageVersion}.`,
    '',
    '## Command Modes',
    '- `tespec validate --file <path>`: 単一 YAML ファイルの構文と Zod スキーマだけを検証します。`config.yaml` は不要です。',
    '- `tespec validate --config <path>`: プロジェクト全体を読み込み、schema validation とクロスリファレンス validation の両方を行います。',
    '',
    '## YAML Reference Example',
    '```yaml',
    'screen: home',
    'route: /',
    'title: ホーム画面',
    'cases:',
    '  - action: 一覧を見る',
    '    expect: 一覧が表示される',
    '    steps:',
    '      - use:logged_in',
    '      - / にアクセスする',
    '    given: logged_in',
    '    navigates_to: detail',
    '```',
    '',
    '## Cross-reference Rules',
    '- `cases[].given` は既存の setup ID を参照する必要があります。',
    '- `cases[].steps` の `use:<setup_id>` は既存の setup ID を参照する必要があります。',
    '- `cases[].navigates_to` は既存の screen ID を参照する必要があります。',
    '- `screen` と `setup` の ID はそれぞれ一意である必要があります。',
    '',
    '## Item Meanings',
    '- `given`: ケース開始前に満たしておきたい setup 条件です。',
    '- `use:<setup_id>`: setup の step 群を呼び出すための特別な step 記法です。',
    '- `navigates_to`: 操作後に遷移する screen ID です。',
    '',
    '## Warning Rules',
    '- `cases` が 0 件の screen は warning になります。',
    '- `type: error` の case が 0 件の screen は warning になります。',
    '- `type: boundary` の case が 0 件の screen は warning になります。',
    '',
    '## Common Mistakes',
    '- `steps` を空配列にする。',
    '- `expect` や `given` の string / string[] を取り違える。',
    '- setup ID や screen ID を自然文で書いてしまい、参照名と一致しない。',
    '- 単一ファイル検証だけで参照整合性まで確認したつもりになる。',
    '',
  ].join('\n');
}
