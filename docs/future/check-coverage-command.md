# tespec check-coverage コマンド

YAML 仕様とテストファイルの対応を自動検証する CLI コマンド。

## コマンドイメージ

```bash
tespec check-coverage -c docs/tespec/config.yaml --tests-dir tests/viewer/
```

## 検証内容

1. **YAML → テストファイル存在**: 全 screen YAML に対応する `.test.ts` が存在するか
2. **YAML case → テスト内容**: 各 YAML の `action` がテストファイル内に含まれているか
3. **孤立テスト検出**: テストファイルに対応する YAML が存在するか
4. **case 数の一致**: YAML の case 数とテスト内の `it()` 数が一致するか

## 出力例

```
OK:    viewer-dashboard.yaml → viewer-dashboard.test.ts (7/7 cases)
OK:    viewer-screen-detail.yaml → viewer-screen-detail.test.ts (6/6 cases)
WARN:  viewer-unit-detail.yaml → viewer-unit-detail.test.ts (2/3 cases missing: "存在しない unit ID")
ERROR: viewer-new-screen.yaml → テストファイルが見つかりません
```

## 実装方針

- `src/commands/check-coverage.ts` として新規コマンド追加
- `tespec validate` と同様に config.yaml を起点にスキャン
- `--tests-dir` でテストディレクトリを指定（デフォルト: `tests/`）
- exit code: 全カバー = 0、不足あり = 1
