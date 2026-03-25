# 07: commands/ + cli.ts — oclif コマンド実装

**状態**: [x] 完了
**概要**: oclif の Command クラスとして validate / generate を実装。core/ を呼び出すオーケストレーションのみ。
**依存**: 03-parser, 04-validator, 05-generator, 06-output 全て完了後

## 実行メモ
- owner: main
- started: 2026-03-25 08:50 JST
- finished: 2026-03-25 09:03 JST
- note: `validate.ts` / `generate.ts` / `cli.ts` を実装し、ESM の oclif エントリは `run(undefined, import.meta.url)` に修正した
- verification:
  - `npm test` 成功
  - `npx tespec validate --help` 成功
  - `npx tespec generate --help` 成功

## タスク

- [ ] 7-1: commands/validate.ts を実装（src/commands/validate.ts）
  - `export default class Validate extends Command`
  - flags: `--config` (string, char: 'c', 設定ファイルパス)
  - run() の処理フロー:
    1. configPath を解決（--config or デフォルト ./docs/tespec/config.yaml）
    2. parseProject(configPath) → errors あれば printError × n → this.exit(1)
    3. validate(screens, setups) → issues を level 別に出力
    4. エラーなしの screen には printOk
    5. hasErrors → this.exit(1) / 警告のみ or 正常 → this.exit(0)
- [ ] 7-2: commands/generate.ts を実装（src/commands/generate.ts）
  - `export default class Generate extends Command`
  - flags: `--config` (string), `--screen` (string), `--dry-run` (boolean)
  - run() の処理フロー:
    1. configPath を解決
    2. parseProject(configPath) → errors あれば exit(1)
    3. validate(screens, setups) → hasErrors なら exit(1)、警告は出力して続行
    4. --screen 指定があれば該当 screen のみに絞り込み
    5. 各 screen に generateTestFile(screen, setups) → 文字列取得
    6. --dry-run → stdout 出力 / else → tests/{screenId}.spec.ts に fs.writeFile
    7. printSuccess(`${n} files generated`)
- [ ] 7-3: cli.ts エントリーポイント（src/cli.ts）
  - `#!/usr/bin/env node`
  - `import { run } from '@oclif/core'; run().catch(require('@oclif/core/handle'));`
- [ ] 7-4: 統合テスト（tests/integration/validate.test.ts）
  - fixture: 正常 YAML → exit 0 + OK 出力
  - fixture: 参照エラーあり → exit 1 + ERROR 出力
  - fixture: 警告のみ → exit 0 + WARN 出力
- [ ] 7-5: 統合テスト（tests/integration/generate.test.ts）
  - fixture: 正常 YAML + --dry-run → stdout にテストスケルトン
  - fixture: 参照エラーあり → exit 1（生成されない）
  - fixture: --screen で絞り込み

## 完了条件
- `npm test` で統合テスト含め全 PASS
- `npx tespec validate --help` と `npx tespec generate --help` がヘルプを表示
