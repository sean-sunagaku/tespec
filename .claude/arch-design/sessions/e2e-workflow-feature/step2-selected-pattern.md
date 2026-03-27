# Step 2: 選定パターン — ADR

## 採用: 案1+2 ミラー縦割り + ValidationIssue 型共通化

### ADR（Architecture Decision Record）

**状況**: tespec に 4 つ目の spec タイプ (Workflow) を追加する際のコード組織パターンを選定する必要があった。

**決定**: 既存の Screen/Unit と完全に同じ縦割りパイプライン（Schema→Parser→Validator→Generator→Viewer）を踏襲しつつ、ValidationIssue/ValidationResult を `validation-types.ts` に共通化する。

**根拠**:
- 合計スコア 22/25（全案中 1 位）
- テスト容易性 5/5・スタック適合性 5/5・学習コスト 5/5
- 新概念ゼロ：既存コントリビューターが即座に理解可能
- 全エージェント（5/5）が推奨
- ValidationIssue の 3 重コピーを防ぐ共通化で堅牢性も確保

**影響**:
- 新ファイル 4 つ（validation-types.ts, workflow-validator.ts, generators/workflow/playwright.ts, WorkflowDetail.tsx）
- 既存ファイル変更 8 つ（schema.ts, parser.ts, validator.ts, unit-validator.ts, generators/types.ts, generators/registry.ts, validate.ts, generate.ts, viewer 関連）
- 将来 5 つ目の spec タイプ追加時も同パターンで対応可能

**棄却した代替案**:
- 案6（サブドメインモジュール / 18pt）: ドメイン分離は現規模では過剰。Screen/Unit との非対称性が保守コスト
- 案3（SpecType レジストリ / 13pt）: 拡張性は最高だが YAGNI。ジェネリクス複雑化でテスト・学習コスト高
- 案9（汎用 SpecCollection / 8pt）: 型安全性を著しく損なう
