# Design Log: check-coverage & check-implemented

## セッション情報
- テーマ: tespec に check-coverage / check-implemented コマンドを追加
- モード: Light
- 開始: 2026-03-27

## 設計方針（Phase A 確定）
- シンプル最優先: 既存の validate/generate パターンを踏襲
- 正規表現ベース: テストファイル解析は regex で it()/test()/it.todo() を検出
- CI 連携見据え: JSON 出力オプション、適切な exit code 設計

## 進捗
- [ ] Step 1: コンテキスト把握
- [ ] Step 2: パターン選定
- [ ] Step 3: モジュール設計
- [ ] Step 4: 設計書出力
