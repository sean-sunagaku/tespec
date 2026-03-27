# Step 1: コンテキスト分析

## 機能要件

### check-coverage コマンド
- YAML 仕様に対応するテストファイルの存在確認
- YAML case 数とテストファイル内の it()/test() 数の一致確認
- 孤立テスト（対応 YAML なし）の検出
- exit code: 0=全カバー / 1=不足あり

### check-implemented コマンド
- テストファイル内の `// TODO: implement` マーカー検出
- `it.todo()` / `test.todo()` / `it.skip()` の検出
- 実装済み/未実装のカウント
- exit code: 0=全実装 / 1=未実装あり

## 非機能要件

| 観点 | 要件 | 優先度 |
|------|------|--------|
| シンプルさ | 既存 validate/generate パターンを踏襲 | 高 |
| テスト容易性 | コアロジックを Command から分離 | 高 |
| CI 連携 | 適切な exit code（JSON 出力は将来検討） | 中 |
| 保守性 | 既存コードベース規模に見合った設計 | 中 |

## 技術スタック
- TypeScript (ESM, NodeNext)
- oclif (CLI フレームワーク, ファイルベース自動ディスカバリ)
- Vitest (テスト)
- Zod (スキーマ検証)
- yaml (YAML パース)

## 既存アーキテクチャ

```
src/
├── commands/         # oclif Command クラス (validate, generate, view)
├── core/
│   ├── parser.ts     # parseProject() → ParsedProject
│   ├── schema.ts     # Zod スキーマ定義
│   ├── validator.ts  # Screen/Setup 参照検証
│   ├── unit-validator.ts
│   └── generators/   # テストスケルトン生成 (fileNameFor 含む)
└── utils/output.ts   # printError, printWarning, printOk, printSuccess
```

### 既存コマンドの共通パターン
1. `parseProject(configPath)` → ParsedProject
2. validate() で検証
3. printOk/printWarning/printError で出力
4. this.exit(1) で異常終了

### テストファイル命名パターン (generators)
- playwright: `{screenId}.spec.ts`
- vitest screen: `{screenId}.test.ts`
- vitest unit: `{unitId}.test.ts`
- xctest: `{ScreenId}Tests.swift`

## 制約条件
- ESM: import に `.js` 拡張子必須
- oclif: ファイル名がコマンド名になる
- 小規模プロジェクト: src/ 約3060行、28ファイル
