# Step 2: coverage-checker.ts 型定義・関数シグネチャ設計

## 確定した探索方式

**glob 全探索** (team-lead 最終決定):
- `tests/` 配下を `*.test.ts`, `*.spec.ts`, `*Tests.swift` で全探索
- ファイル名 stem で YAML screen ID とマッチ
- `--target` フラグ不要

---

## 公開インターフェース

### coverage-checker.ts

```typescript
// src/core/coverage-checker.ts

export interface ScreenCoverageEntry {
  screenId: string;          // YAML で定義された screen ID
  specFile: string | null;   // マッチしたテストファイルパス（絶対パス）。なし時は null
  caseCount: number;         // YAML の cases 数
  testCount: number | null;  // テストファイルの it()/test() 数（ファイルなし時は null）
  missing: boolean;          // テストファイルが存在しない
  countMismatch: boolean;    // caseCount !== testCount かつ missing === false
}

export interface OrphanedTestEntry {
  specFile: string;          // 対応 YAML なしのテストファイルパス（絶対パス）
}

export interface CoverageResult {
  screens: ScreenCoverageEntry[];
  orphaned: OrphanedTestEntry[];
  hasMissing: boolean;       // 未カバー screen が存在する
  hasOrphaned: boolean;      // 孤立テストが存在する
  hasMismatch: boolean;      // case 数不一致が存在する
}

export async function checkCoverage(
  screens: Screen[],
  testsDir: string,   // 絶対パス
): Promise<CoverageResult>
```

**注意**: `--target` フラグなし。`UnitSpec` の coverage チェックは初回スコープ外。

---

### impl-checker.ts

```typescript
// src/core/impl-checker.ts

export interface ImplEntry {
  specFile: string;           // テストファイルパス（絶対パス）
  totalTests: number;
  implementedCount: number;
  unimplementedCount: number;
  unimplementedItems: UnimplItem[];
}

export interface UnimplItem {
  line: number;
  kind: 'todo-marker' | 'it.todo' | 'test.todo' | 'it.skip' | 'test.skip';
  text: string;               // テスト名またはマーカー周辺テキスト
}

export interface ImplResult {
  entries: ImplEntry[];
  hasUnimplemented: boolean;
}

export async function checkImplemented(
  testsDir: string,   // 絶対パス
): Promise<ImplResult>
```

---

## 内部実装（非公開）

### coverage-checker.ts 内部

```typescript
// glob 全探索でテストファイル一覧を取得
async function collectTestFiles(testsDir: string): Promise<string[]>
// readdir 再帰で *.test.ts / *.spec.ts / *Tests.swift を収集（parser.ts の collectYamlFiles と同パターン）

// ファイル名 stem の抽出
function stemOf(filePath: string): string
// path.basename(filePath, ext) で拡張子除去
// *Tests.swift の場合は capitalize を戻す: "LoginTests.swift" → "login"（小文字化）
// または: stem が YAML ID と大文字小文字を区別してマッチするか確認

// テストカウント
async function countTestsInFile(filePath: string): Promise<number>
// it( / test( の呼び出し数を正規表現でカウント（it.todo/it.skip 含む）
```

### impl-checker.ts 内部

```typescript
// 未実装マーカーの検出
function detectUnimplItems(source: string): UnimplItem[]
// パターン: it.todo( / test.todo( / it.skip( / test.skip( / // TODO: implement
```

---

## コマンド仕様

### check-coverage.ts

```typescript
export default class CheckCoverage extends Command {
  static summary = 'Check that all YAML specs have corresponding test files';

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to tespec config.yaml',
    }),
    'tests-dir': Flags.string({
      description: 'Path to test files directory',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CheckCoverage);
    const configPath = resolveConfigPath(flags.config);
    const parsed = await parseProject(configPath);

    if (parsed.errors.length > 0 || !parsed.result) {
      for (const error of parsed.errors) {
        printError(error.file, error.message);
      }
      this.exit(1);
    }

    const result = await checkCoverage(
      parsed.result.screens,
      path.resolve(flags['tests-dir']),
    );

    // 出力:
    // missing     → printError(screenId, 'テストファイルが見つかりません')
    // countMismatch → printWarning(specFile, `case ${n} 件に対してテスト ${m} 件`)
    // orphaned    → printWarning(specFile, '対応する YAML 仕様がありません')
    // ok          → printOk(specFile)

    if (result.hasMissing || result.hasMismatch || result.hasOrphaned) {
      this.exit(1);
    }
  }
}
```

**exit code**:
- `0`: 全 screen にテストファイルあり、case 数一致、孤立テストなし
- `1`: missing / mismatch / orphaned のいずれかあり

### check-implemented.ts

```typescript
export default class CheckImplemented extends Command {
  static summary = 'Check that all test cases are implemented (no TODO/skip)';

  static flags = {
    'tests-dir': Flags.string({
      description: 'Path to test files directory',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CheckImplemented);
    const result = await checkImplemented(path.resolve(flags['tests-dir']));

    // 出力:
    // unimplemented → printWarning(specFile, `line N: ${kind} "${text}"`)
    // ok           → printOk(specFile)

    if (result.hasUnimplemented) {
      this.exit(1);
    }
  }
}
```

**注意**: `parseProject` 不要（テストファイルのみ解析）。

---

## 既存コードとの結合点

| 既存 | 用途 |
|------|------|
| `parseProject(configPath)` | check-coverage コマンドで `Screen[]` を取得 |
| `printError(file, message)` | missing テスト・parse エラーの出力 |
| `printWarning(file, message)` | mismatch・orphaned・unimplemented の出力 |
| `printOk(file)` | カバー済み・実装済みの出力 |
| `this.exit(1)` | 異常終了（oclif 標準パターン） |

`printSuccess()` は使用しない。

---

## 設計上の決定メモ

1. **`specFile: string | null`**: ファイルが存在しない場合は `null`（`missing: true` と一致）
2. **`testCount: number | null`**: ファイルなし時は `null`（`0` と区別する）
3. **Swift ファイル stem**: `LoginTests.swift` → stem `Login` → YAML ID `login`（小文字化でマッチ）。大文字小文字を区別しないマッチングを採用。
4. **it.todo()/it.skip() のカウント**: `countTestsInFile` では全 it()/test() をカウント（skip/todo 含む）。未実装判定は impl-checker の責務。
5. **`--tests-dir` は必須フラグ**: config.yaml に tests_dir フィールドは存在しない。
6. **Screen のみ対象**: UnitSpec カバレッジは初回スコープ外。
7. **`collectTestFiles` は `collectYamlFiles` と同パターン**: readdir 再帰、既存コードの構造を踏襲。
