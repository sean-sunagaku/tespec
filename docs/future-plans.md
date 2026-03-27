# tespec 将来拡張

tespec-design.md で定義した仕組みの将来拡張案。

---

## 1. テストスケルトン生成

YAML からテストスケルトンを自動生成する。

```
screens/home.yaml → tests/screens/home.spec.ts
```

```typescript
import { test, expect } from "@playwright/test";

test.describe("ホーム画面", () => {
  test("画面を開く → プロジェクト一覧が表示される", async ({ page }) => {
    // TODO: implement
  });

  test.describe("異常系", () => {
    test("[offline] 画面を開く → エラーメッセージが表示される", async ({ page }) => {
      // TODO: implement
    });
  });
});
```

---

## 2. テスト優先度

case に `priority` フィールドを追加。

```yaml
- action: "決済ボタンをタップ"
  expect: "決済処理が完了する"
  priority: critical
```

多い時に「どこから書くか」の判断材料になる。

---

## 3. AI エージェント向け指示生成

```bash
npx tespec next --format prompt
```

未実装のケースを AI へのプロンプト形式で出力する。

```
次の 3 ケースを実装してください。

## home: 新規作成ボタンをタップ
- ファイル: tests/screens/home.spec.ts
- expect:
  - 作成ダイアログが表示される
  - フォームが空の状態で表示される
```

---

## 4. テストカバレッジ検証コマンド

YAML 仕様に対応するテストが全て存在するかを検証する。

```bash
npx tespec coverage [--config <path>] [--test-dir <path>]
```

```
Coverage Report:
──────────────────────────────────────
screens/home.yaml        ✓ tests/home.spec.ts
screens/login.yaml       ✓ tests/login.spec.ts
workflows/checkout.yaml  ✗ テストファイルが見つかりません
units/parser.yaml        ✓ tests/parser.test.ts
──────────────────────────────────────
Coverage: 3/4 (75%)

Missing:
  workflows/checkout.yaml → tests/checkout.spec.ts
```

チェック項目:

| チェック | 説明 |
|---------|------|
| 生成済みファイルの存在 | YAML に対応するテストファイルが test-dir に存在するか |
| TODO 残存 | 生成されたスケルトンに `// TODO: implement` が残っていないか |
| ケース数一致 | YAML の case 数とテストファイル内の test 数が一致するか |

exit code: 未カバーの YAML がある場合は 1

---

## 5. GitHub Actions 連携

PR に「画面ごとのテスト実装状況」をコメントする。

```yaml
# .github/workflows/tespec.yaml
- run: npx tespec status --format json > status.json
- uses: tespec/action@v1
  with:
    status-file: status.json
```
