# 01: プロジェクトスキャフォールド

**状態**: [x] 完了
**概要**: package.json、tsconfig.json、tsup 設定、oclif 設定、ディレクトリ構造を作成する

## 実行メモ
- owner: main
- started: 2026-03-24 21:01 JST
- note: build 可能な最小 CLI エントリーポイントまで先に作る
- finished: 2026-03-24 21:06 JST
- verification: `npm run build` 成功、`src/commands`, `src/core`, `src/utils` を作成済み

## タスク

- [ ] 1-1: `npm init -y` で package.json を作成し以下を設定
  - name: "tespec", version: "0.1.0", type: "module"
  - bin: { "tespec": "./dist/cli.js" }
  - engines: { node: ">=18" }
  - exports, main, module, types フィールド
- [ ] 1-2: 依存パッケージのインストール
  - dependencies: @oclif/core, yaml, zod, picocolors
  - devDependencies: typescript, tsup, vitest, @types/node
- [ ] 1-3: tsconfig.json を作成
  - target: ES2022, module: NodeNext, strict: true, outDir: ./dist
- [ ] 1-4: tsup.config.ts を作成
  - entry: ['src/cli.ts'], format: ['esm'], dts: true, clean: true, shims: true
- [ ] 1-5: oclif の設定を package.json に追加
  - oclif.commands: "./dist/commands", oclif.bin: "tespec"
- [ ] 1-6: ディレクトリ構造を作成
  - src/, src/commands/, src/core/, src/utils/
- [ ] 1-7: .gitignore に dist/, node_modules/, .status.json を追加
- [ ] 1-8: npm scripts を設定
  - build: tsup, test: vitest, dev: tsup --watch

## 完了条件
- `npm run build` がエラーなく完了する
- src/ ディレクトリ構造が存在する
