# Step 2: 選定パターン

## 選定: パターン A — Flat Extension + Type-Specific Modules

### 選定理由

1. **変更量が最小**: 新規3ファイル + 既存6ファイル追記のみ。ファイル移動・リネームなし
2. **既存コードへの影響が極小**: validator.ts, playwright.ts, xctest.ts は一切変更なし
3. **Step 1 確定方針との一致**: ユーザー判断「ディレクトリ分割なし、フラット追加」に完全準拠
4. **全エージェントの合意点を統合**: interface 分離、registry 分離、validator 分離の方針を最もシンプルに実現
5. **後方互換**: 既存 CLI、既存 config.yaml がそのまま動作。`FrameworkGenerator` は type alias で互換維持

### 確定した設計判断

| 判断項目 | 結論 | 根拠 |
|---------|------|------|
| UnitCaseSchema | 独立定義（CaseSchema と共有しない） | ユーザー判断。Screen の steps(必須) を持たない |
| methods ネスト | 維持（B案ネスト） | ユーザー判断。Phase A で確定済み |
| `--type` フラグ | なし（自動判定） | ユーザー判断。units_dir の有無で自動判定 |
| Generator interface | ScreenGenerator / UnitGenerator 分離 | 引数型が異なる（Screen+Setup[] vs UnitSpec） |
| Target 型 | ScreenTarget / UnitTarget 分離 | 無効な組み合わせをコンパイル時排除 |
| Registry | 1ファイルに Screen/Unit 両方の registry | ファイル数抑制。ルックアップ関数で分離 |
| Validator | unit-validator.ts を新規作成 | 既存 validator.ts は変更なし |
| Config | units_dir を `.default('./units')` で追加 | 後方互換 |
| 汎用 spec type 機構 | 不要 | 2種類のハードコードで十分（Rule of Three） |

### 不採用パターンの理由

- **B (Namespace Directory)**: 530行のコードベースに対してリファクタコストが不釣り合い
- **C (Generic Framework)**: 2種類の spec type に対して過剰設計。ジェネリック型が不自然に複雑化

### Step 3 への引き継ぎ事項

Step 3（モジュール詳細設計）で解決すべき項目:

1. **units_dir 不在時の挙動**: ディレクトリが存在しない場合、エラーにするかスキップするか
2. **generate コマンドの target 解決**: `--target` フラグが Screen/Unit どちらに適用されるかのロジック
3. **Unit 用 `--unit` フラグ**: `--screen` と同様に特定 Unit のみ生成する機能の要否
4. **validate の単一ファイル検証**: `--file` で Unit YAML を指定した場合の UnitSpecSchema 試行ロジック
5. **vitest / xctest-unit の出力フォーマット詳細**: テスト名の命名規則、import 文、コメント構造
