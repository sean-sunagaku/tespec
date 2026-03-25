# 08: ビルド・動作確認・ドキュメント

**状態**: [x] 完了
**概要**: tsup ビルド、npx tespec の動作確認、サンプル YAML 配置、README 記載。
**依存**: 07-commands 完了後

## 実行メモ
- owner: main + subagent team
- started: 2026-03-25 08:55 JST
- finished: 2026-03-25 09:03 JST
- note: `docs/tespec/**` のサンプル YAML と `README.md` を整備し、ビルド済み CLI で正常系・異常系の動作を確認した
- verification:
  - `npm run build` 成功
  - `node dist/cli.js validate -c docs/tespec/config.yaml` 成功
  - `node dist/cli.js validate -c tests/fixtures/command-error/config.yaml` で exit 1 と ERROR 出力を確認
  - `node dist/cli.js generate -c docs/tespec/config.yaml --dry-run` でスケルトン出力を確認
  - `README.md` 存在確認

## タスク

- [ ] 8-1: サンプル YAML を docs/tespec/ に配置
  - docs/tespec/config.yaml
  - docs/tespec/screens/login.yaml（docs/tespec-design.md の記述例ベース）
  - docs/tespec/screens/home.yaml（フル記述例ベース）
  - docs/tespec/setups/auth.yaml
  - docs/tespec/setups/seed-data.yaml
- [ ] 8-2: `npm run build` → dist/ が生成されることを確認
- [ ] 8-3: `npx tespec validate` をサンプル YAML に対して実行
  - 全 OK の場合の出力確認
  - 意図的にエラーを入れた場合の出力確認
- [ ] 8-4: `npx tespec generate --dry-run` を実行
  - stdout にテストスケルトンが出力されることを確認
  - 出力が Playwright の構文として妥当か目視確認
- [ ] 8-5: README.md に最低限の記載
  - プロジェクト概要（1-2文）
  - インストール: `npm install -g tespec` / `npx tespec`
  - 使い方: validate / generate の基本コマンド
  - YAML の書き方: docs/tespec-design.md へのリンク
  - ライセンス: MIT

## 完了条件
- `npm run build` がエラーなし
- `npx tespec validate` がサンプル YAML で正常動作
- `npx tespec generate --dry-run` がスケルトンを出力
- README.md が存在する
