# Devils Advocate: Step 3 過剰分割チェック

作成日: 2026-03-25

---

## チェック対象（Pattern 10 + E2 の確定実装内容）

1. `scripts/generate-references.ts` — schema.ts → references/*.md 生成
2. `SKILL.md` — 手書き
3. `references/*.md` — 自動生成（case-schema.md / screen-schema.md / setup-schema.md）
4. `tespec validate --file` — validate.ts + parser.ts に軽微変更
5. `.github/workflows/sync-references.yml` — 自動更新 workflow
6. `package.json` — tsx 追加 + `skill:sync` スクリプト追加

---

## 各項目の過剰分割チェック

### 1. `scripts/generate-references.ts`

**チェック: 分割は必要か？**

想定実装:
- `z.toJSONSchema(CaseSchema)` → JSON → Markdown テーブル変換 → ファイル書き出し
- 4 スキーマ分を繰り返す

推定行数: 60〜100 行（platform-expert の見積もり）

**判定: 分割不要。1 ファイルで完結させる。**

- 100 行以下のスクリプトを複数ファイルに分ける理由はない
- 他から import するユースケースが Phase 1 には存在しない（YAGNI）
- `src/skill/` への移動は「100 行超え」または「他から import が必要になった時」を明示的なトリガーとする

**注意点:** JSON Schema → Markdown 変換のヘルパー関数（`jsonSchemaToMarkdown` 等）はスクリプト内に inline で書く。別ファイルに分けない。

---

### 2. `SKILL.md`

**チェック: 複数ファイルに分割すべきか？**

candidates:
- `SKILL.md`（指示部分）+ `references/` への分離は確定済み
- SKILL.md 自体をさらに分割する提案が出た場合は却下

**判定: SKILL.md は 1 ファイル。内部セクション分割は構わないが、ファイル分割は不要。**

---

### 3. `references/*.md`（自動生成）

**チェック: ファイル数は最小か？**

現在想定されているファイル:
- `case-schema.md`
- `screen-schema.md`
- `setup-schema.md`
- `config-schema.md`（必要か？）

**判定: 4 スキーマ分 = 4 ファイル。妥当。**

ただし `config-schema.md` について:
- ConfigSchema は `version`, `project`, `screens_dir`, `setups_dir` の 4 フィールドのみ
- AI が YAML を生成する際に config.yaml を新規作成するシナリオは稀
- `config-schema.md` を生成するかは実装者が判断。過剰なら除外してよい

---

### 4. `tespec validate --file`（E2）

**チェック: 変更範囲は最小か？**

必要な変更:
- `src/commands/validate.ts`: `--file` フラグ追加
- `src/core/parser.ts`: 単体ファイルパース関数の export 追加（または新規追加）

**判定: 2 ファイルへの軽微変更。妥当。**

過剰設計の警戒点:
- `parser.ts` に新しい public API を追加する場合、既存テストへの影響を確認すること
- `parseYamlFile(filePath: string)` のような単純な関数 1 つで十分。複雑な抽象化は不要
- `validate.ts` の変更は `--file` フラグ追加 + 分岐追加のみ。リファクタリングを一緒にしない

---

### 5. `.github/workflows/sync-references.yml`

**チェック: 1 ファイルで完結するか？**

必要なステップ:
1. `pnpm install`
2. `pnpm tsx scripts/generate-references.ts`
3. `git diff --exit-code skill/references/`
4. `git commit` + `gh pr create`（差分ありの場合のみ）

**判定: 1 ファイルで完結。分割不要。**

過剰設計の警戒点:
- reusable workflow（`.github/workflows/` の共通化）は不要。1 つの workflow しか存在しない
- `peter-evans/create-pull-request` action は不使用（P10 の選択通り、gh コマンドのみ）
- matrix build は不要

---

### 6. `package.json` の変更

**チェック: 追加する設定は最小か？**

必要な変更:
```json
"devDependencies": {
  "tsx": "^..."
},
"scripts": {
  "skill:sync": "tsx scripts/generate-references.ts"
}
```

**判定: 2 箇所の追加。妥当。**

過剰設計の警戒点:
- `skill:validate`, `skill:check` 等の追加スクリプトは不要
- `prepublishOnly` への追記は慎重に（自動実行のタイミング問題）

---

## module-designer へのチェックポイント

module-designer がモジュール分割提案を出す際に devils-advocate が確認する観点:

1. **`scripts/generate-references.ts` を複数ファイルに分けていないか**
   - `src/skill/references-generator.ts`（ライブラリ）+ `scripts/sync.ts`（エントリポイント）の 2 層構造は過剰。Phase 1 では 1 ファイルで十分。
   - 分割トリガー: 100 行超え OR 他から import が必要になった時

2. **`validate.ts` の変更が `--file` フラグ追加にとどまっているか**
   - 既存ロジックのリファクタリングを同時にしない

3. **新規ディレクトリが増えていないか**
   - `src/skill/` は Phase 1 では作らない（確定済み）
   - 配置先: `skills/tespec-yaml-gen/`（Vercel Labs skills 規約・ユーザー確定 2026-03-25）
   - 構造: `skills/tespec-yaml-gen/SKILL.md` + `skills/tespec-yaml-gen/rules/*.md`
   - `rules/` 内: case-schema.md / screen-schema.md / setup-schema.md / validation-rules.md（全て自動生成、ConfigSchema から生成）
   - `npx skills add` でインストール可能。妥当。

4. **test ファイルの追加は最小か**
   - `scripts/generate-references.ts` の単体テストは Phase 1 では不要
   - E2 の `--file` フラグのテストは既存テスト構造に沿って追加

---

## 最終判定（module-designer 提案・dependency-analyst 依存グラフ確認後）

更新日: 2026-03-25（Skill 配置パス確定により再更新）

**全体: 承認。ブロッカーなし。**

- `scripts/generate-references.ts`: 1 ファイル完結。Layer 5 として単独配置。2 層分離なし。
- `validate.ts` の `--file` フィルタリング（5-10行）: `validate.ts` 内に直書きで十分。別モジュール不要。
- `parser.ts`: export 2行追加（`parseYamlFile` + `ParsedFileResult`）。`--file` 単体動作に必要。
- Skill 配置: `skills/tespec-yaml-gen/`（`rules/` サブディレクトリ）に確定。validation-rules.md は手書き。
- 新規依存 1 本のみ（`scripts/generate-references.ts → src/core/schema.ts`）。循環依存ゼロ。

devils-advocate のすべてのチェックポイントをパス。
