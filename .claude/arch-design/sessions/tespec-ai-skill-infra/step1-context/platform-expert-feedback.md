# Platform Expert Feedback: tespec AI Skill Infrastructure Analysis

## 1. 技術スタック詳細

### 現在のセットアップ
- **package.json**: `"type": "module"` (Pure ESM)
- **TypeScript**: `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`
- **tsup**: entry `['src/cli.ts', 'src/commands/*.ts']`, format `esm`, dts生成あり
- **oclif**: `{ bin: "tespec", commands: "./dist/commands" }` — `commands/` ディレクトリスキャン方式
- **Zod**: `^4.1.12`
- **Node.js**: `>=18`

---

## 2. oclif サブコマンド追加パターン

### 現在の構造
```
src/commands/
  validate.ts   → `tespec validate`
  generate.ts   → `tespec generate`
```

### 新コマンド追加手順
1. `src/commands/add-skill.ts` にファイルを作成するだけでOK
2. oclifは `package.json` の `oclif.commands: "./dist/commands"` で**ディレクトリ全体を自動スキャン**する
3. tsupの `entry: ['src/cli.ts', 'src/commands/*.ts']` に `src/commands/add-skill.ts` が自動的に含まれる
4. **manifest生成は不要** — oclif v4はビルド時ではなく実行時にコマンドをディスカバリーする

### コマンドクラスのパターン（既存コードから）
```typescript
import { Command, Flags } from '@oclif/core';

export default class AddSkill extends Command {
  static summary = 'Install tespec AI Skill to Claude Code';

  static flags = {
    target: Flags.string({
      char: 't',
      description: 'Target directory (default: ~/.claude/skills/tespec/)',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AddSkill);
    // fs操作でスキルファイルをコピー
  }
}
```

**制約なし**: サブコマンド追加はシンプル。ファイル追加のみ。

---

## 3. Claude Code Skill の配布方式と技術的制約

### Claude Code Skills の実際の配布仕組み
調査の結果、**npx方式ではなく、Gitリポジトリベースのプラグインシステム**が正解。

```
~/.claude/plugins/
  known_marketplaces.json   ← マーケットプレイス登録
  installed_plugins.json    ← インストール済み一覧
  marketplaces/             ← GitリポジトリのClone先
    sunagaku-marketplace/   ← git@github.com:sean-sunagaku/claude-code-plugin.git
  cache/                    ← インストール済みスキルの実体
    sunagaku-marketplace/
      agent-team/1.0.0/
        skills/
          agent-team/
            SKILL.md
            references/
            examples/
```

### Claude Code Skill の正しい構造
```
<repository>/
  <category>/
    <skill-name>/
      skills/
        <skill-name>/
          SKILL.md          ← スキル本体（フロントマター + 指示）
          references/       ← 参照ドキュメント（YAML例, スキーマ等）
            *.md
          scripts/          ← シェルスクリプト（任意）
```

### SKILL.md フロントマター形式
```markdown
---
name: <skill-name>
description: <Claude Codeがスキル選択に使うトリガー文>
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Edit, Bash
---
```

### 重要な制約
- **npx方式は非対応**: Claude Code SkillsはGitリポジトリ＋`/plugin install`コマンドで管理
- **ファイルコピー先**: `~/.claude/plugins/cache/<marketplace>/<skill>/<version>/skills/`
- **`~/.claude/skills/`は存在しない**: 実際のパスは `~/.claude/plugins/cache/` 以下
- **`tespec add-skill`コマンド（npx経由）は不要**: Skillの配布は別チャンネル（Gitリポジトリ）

### 推奨配布方式
tespecのAI Skillは `sean-sunagaku/claude-code-plugin` リポジトリ（既存のsunagaku-marketplace）に追加するのが最もシンプル。

```
# ユーザー側のインストール手順
/plugin install tespec@sunagaku-marketplace
```

---

## 4. Zod v4 → JSON Schema / ドキュメント自動生成

### `z.toJSONSchema()` — 完全に利用可能

```typescript
import { z, toJSONSchema } from 'zod';

const jsonSchema = z.toJSONSchema(CaseSchema);
// → JSON Schema Draft 2020-12 で出力
```

### CaseSchema の実際の出力例
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "action": { "type": "string" },
    "expect": { "anyOf": [{"type":"string"}, {"type":"array","items":{"type":"string"}}] },
    "steps": { "minItems": 1, "type": "array", "items": {"type": "string"} },
    "type": { "default": "normal", "type": "string", "enum": ["normal","error","boundary"] }
  },
  "required": ["action", "expect", "steps", "type"],
  "additionalProperties": false
}
```

### ドキュメント自動生成への活用
`z.toJSONSchema()` の出力から以下を自動生成できる:
- YAML スキーマリファレンス（`references/schema.md`）
- バリデーションエラーの説明文
- SKILL.md のコンテキスト部分

**実装イメージ**（`scripts/generate-references.ts`）:
```typescript
import { toJSONSchema } from 'zod';
import { CaseSchema, ScreenSchema, SetupSchema } from '../src/core/schema.js';

const schemas = { CaseSchema, ScreenSchema, SetupSchema };
// → JSON Schema → Markdown テーブル変換 → references/*.md に書き出し
```

---

## 5. tsup でバンドルした場合の静的ファイル（SKILL.md等）の扱い

### 問題
tsupはJavaScript/TypeScriptのバンドラーであり、`SKILL.md`等の静的ファイルをビルド成果物に**自動コピーしない**。

### 現在の package.json の `files` フィールド
```json
"files": ["dist", "README.md", "LICENSE"]
```

### 解決策（2案）

**案A（推奨）: スキルファイルをnpmパッケージには含めず、別リポジトリで管理**
- tespec npm パッケージ = CLI ツール
- tespec skill = `sean-sunagaku/claude-code-plugin` リポジトリ内の `development/tespec-yaml-gen/skills/`
- 完全に独立したライフサイクル

**案B: `files` フィールドと `copyPublicDir`（tsup）で静的ファイルをバンドル**
```json
// package.json
"files": ["dist", "skills", "README.md", "LICENSE"]
```
```typescript
// tsup.config.ts
export default defineConfig({
  // ... 既存設定 ...
  // tsupはpublicDirのコピーに対応 (tsup --public-dir ./skills → dist/skills/)
});
```
ただし、`tespec add-skill`コマンド（npx実行）でのコピーを想定する場合のみ必要。
**現行の Claude Code Plugin 仕組みでは不要**。

---

## 6. スキーマ変更時の自動更新（Skill リファレンス + テストフィクスチャ）

### 提案: `scripts/sync-skill-references.ts`

```
スキーマ変更
  └→ pnpm run sync-skill-references
       └→ z.toJSONSchema() で各スキーマを変換
       └→ references/case-schema.md を再生成
       └→ references/screen-schema.md を再生成
       └→ テストフィクスチャのYAML例も更新
```

これを CI（GitHub Actions）の `build` ジョブで実行すれば、スキーマ変更時に自動的にリファレンスが更新される。

---

## 7. 結論・設計上の重要知見

| 項目 | 結論 |
|---|---|
| `tespec add-skill` コマンド | **不要**。Claude Code Plugin 方式で配布が正解 |
| Skills の配布方法 | Gitリポジトリ（`sean-sunagaku/claude-code-plugin`）に追加 |
| スキルのインストール | `claude plugin install tespec@sunagaku-marketplace` |
| Zod v4 toJSONSchema | **利用可能**。`z.toJSONSchema(schema)` で完全なJSON Schema出力 |
| oclif サブコマンド追加 | ファイル追加のみ。ディレクトリスキャン方式で自動認識 |
| tsup と静的ファイル | 案A（分離管理）を推奨 |
| スキーマ変更時の自動更新 | `scripts/sync-skill-references.ts` + GitHub Actions |

### 最優先実装項目（シンプル最優先）
1. `sean-sunagaku/claude-code-plugin` に `development/tespec-yaml-gen/` を追加
2. `skills/tespec-yaml-gen/SKILL.md` に tespec YAML 生成の指示を記述
3. `skills/tespec-yaml-gen/references/` に Zod スキーマから自動生成した YAML スキーマリファレンスを配置
4. `scripts/generate-references.ts` を tespec リポジトリに追加し、`prepublishOnly` フックで実行
