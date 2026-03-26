# Step 3: Devil's Advocate YAGNI 最終レビュー

## 総合判定: 概ね適切。過剰設計リスクは低い。

Module Designer と Dependency Analyst の設計は Step 1-2 の合意事項を忠実に反映しており、530行のコードベースに対して適切な複雑度です。以下、批判ポイントを重大度順に列挙します。

---

## 批判 1: `--unit-target` フラグ vs config.yaml `unit_target` の不一致 [重要]

Module Designer は `--unit-target` CLI フラグを提案し、Dependency Analyst は `config.yaml` の `unit_target` フィールドを提案しています。**両者の設計が矛盾しています。**

### Module Designer 案: `--unit-target vitest`
- 長所: CLI フラグとして直感的。`--target` (Screen用) と対称的
- 短所: フラグが増える。Screen は `--target`、Unit は `--unit-target` で命名規則が非対称

### Dependency Analyst 案: config.yaml の `unit_target: vitest`
- 長所: CLI フラグを増やさない。プロジェクト単位で固定される target を config で管理するのは合理的
- 短所: Screen の target は CLI フラグ、Unit の target は config で管理方法が非対称

### Devil's Advocate 推奨: `--unit-target` CLI フラグ（Module Designer 案）

理由:
1. Screen の `--target` との対称性。管理方法の一貫性
2. config.yaml にフレームワーク固有の設定を混ぜない方が設計書としての純粋さを維持
3. デフォルト `vitest` なので、99%のケースでフラグ指定不要
4. config に `unit_target` を追加すると ConfigSchema の肥大化が始まる（将来 `screen_target` も追加すべきかという議論が発生）

ただし、**MVP ではもっとシンプルに: Unit は vitest 固定、xctest-unit.ts は後回し** が最もシンプル。Step 1 で vitest + XCTest 同時が確定方針なので、方針変更が許容されない場合は `--unit-target` フラグを採用。

---

## 批判 2: ValidationIssue / ValidationResult の重複定義 [軽微、受け入れ可能]

Module Designer は unit-validator.ts に `ValidationIssue` / `ValidationResult` を再定義しています。Dependency Analyst は validator.ts から import する案でした。

Module Designer 案の根拠「37行程度の重複は許容。抽出は3種類目で検討」は Rule of Three に基づいており合理的。ただし、**同じ型を2箇所で定義すると、片方にフィールドを追加した時にもう片方を更新し忘れるリスクがある**。

### Devil's Advocate 推奨: validator.ts から import（Dependency Analyst 案）

- 型のみの import で、ロジックへの依存は発生しない
- unit-validator.ts から validator.ts への依存方向は安全（Dependency Analyst が検証済み）
- 9行の重複を避けるために1行の import を追加するだけ

ただしこれは軽微な問題であり、どちらでも機能します。

---

## 批判 3: `--unit` フラグの必要性 [軽微]

```typescript
unit: Flags.string({
  description: 'Generate only a specific unit id',
}),
```

`--screen` と対称的に `--unit` を追加する設計は理解できますが、MVP で本当に必要か。

- Unit YAML が1-3ファイルの段階では `--unit` で絞り込むニーズは低い
- Screen 用の `--screen` フラグは「多数の画面がある中で1つだけ再生成したい」ケースで有用だが、Unit は画面より数が少ない傾向

**判定: 実装コストが低い（既存パターンのコピー）ため、追加しても問題ない。ただし MVP で必須ではない。**

---

## 批判 4: validate --file の Screen → Setup → Unit 試行順序 [軽微]

```typescript
// 1. Screen として試行
// 2. Setup として試行
// 3. Unit として試行 (追加)
```

3つのスキーマを順番に試行するアプローチは、spec type が増えるたびに試行回数が増えます。

**代替案: ファイルパスから推測**
- パスに `units/` を含む → UnitSpecSchema で試行
- パスに `screens/` を含む → ScreenSchema で試行
- パスに `setups/` を含む → SetupSchema で試行
- それ以外 → 全試行

ただしこれは最適化であり、3種類の段階では全試行でも問題ありません。**現行設計で十分。**

---

## 批判 5: generators/ 内のコード重複 [受け入れ済み]

vitest.ts と playwright.ts で `indentOf` / `quote` が重複。xctest-unit.ts と xctest.ts で `toSwiftClassName` / `sanitize` / `indentOf` が重複。

Module Designer は「共通化しない (KISS — 3種類目で検討)」としており、これは正しい判断です。**批判なし。**

---

## 批判 6: 全体の複雑度チェック

### 変更量の妥当性

| 区分 | ファイル数 | 推定追加行数 |
|------|-----------|-------------|
| 新規 | 3 | ~300行 (validator ~80行, vitest ~70行, xctest-unit ~100行) |
| 追記 | 6 | ~150行 (schema ~30行, parser ~20行, types ~15行, registry ~30行, validate ~30行, generate ~40行) |
| リネーム | 4 | ~14箇所 (types, registry, playwright, xctest の import/型名) |
| 変更なし | 3 | 0行 |

合計: ~450行の追加 + 14箇所のリネーム。現在530行のコードベースに対して約85%の増加。

**判定: Unit Spec という新機能（スキーマ + パーサ拡張 + バリデータ + 2ジェネレータ + コマンド拡張）としては妥当な規模。過剰ではない。**

---

## 未解決: `--unit-target` vs config `unit_target` の統一

この点は team-lead / architecture-lead の判断が必要です。Module Designer と Dependency Analyst で提案が異なっているため、Step 3 の確定前に統一すべきです。

---

## まとめ

| 批判ポイント | 重大度 | 推奨 |
|-------------|--------|------|
| `--unit-target` vs config `unit_target` | 重要 | `--unit-target` CLI フラグを採用（統一が必要） |
| ValidationIssue 重複定義 | 軽微 | validator.ts から import が望ましいが、どちらでも可 |
| `--unit` フラグ | 軽微 | 実装コスト低いので追加 OK。MVP 必須ではない |
| validate --file 試行順序 | 軽微 | 現行設計で十分 |
| generators/ コード重複 | なし | KISS で正しい |
| 全体複雑度 | なし | 530行 → ~980行。新機能として妥当 |

**全体として、この設計は530行のコードベースに対して適切な複雑度であり、過剰設計のリスクは低い。**
