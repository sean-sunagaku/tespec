# Design Log: Unit Spec Extension

## セッション情報
- テーマ: tespec Unit Spec 拡張
- モード: Standard
- 開始: 2026-03-26

## Phase A: 事前ヒアリング結果
- 設計哲学: 独立性優先（Screen と Zod スキーマを共有しない）
- 生成ターゲット: vitest + XCTest
- 将来拡張: screen transition spec くらい（最大3種類）
- コマンド体系: デフォルト全処理、`--type` で絞り込み
- YAML 構造: `unit:` トップレベル、`methods:` ネスト、`units/` ディレクトリ

## ステップ進捗
- [ ] Step 1: 仕様・コンテキストの把握
- [ ] Step 2: アーキテクチャ案の列挙・比較・選定
- [ ] Step 3: モジュール設計・依存関係定義
- [ ] Step 4: 設計書出力・ユーザー承認
