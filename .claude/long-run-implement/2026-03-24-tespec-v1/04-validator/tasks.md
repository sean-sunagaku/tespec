# 04: core/validator.ts — 参照整合性チェック

**状態**: [x] 完了
**概要**: パース済みオブジェクトのクロスファイル参照整合性をチェックする純粋関数。tespec の核心的価値「バリデーションの信頼性」を担う最重要モジュール。全エラー/警告を1件も見逃さず収集する。
**依存**: 02-schema 完了後（parser とは独立してテスト可能）

## 実行メモ
- owner: subagent (`gpt-5.4 xhigh`)
- started: 2026-03-24 21:06 JST
- note: `src/core/validator.ts` と `src/core/validator.test.ts` のみを担当
- finished: 2026-03-25 09:03 JST
- verification: `npm test` 成功、`src/core/validator.test.ts` を含む全 27 テスト PASS

## タスク

- [ ] 4-1: ValidationIssue と ValidationResult の型を定義（src/core/validator.ts）
  - ValidationIssue: { level: 'error' | 'warning', file: string, field: string, message: string }
  - ValidationResult: { issues: ValidationIssue[], hasErrors: boolean }
- [ ] 4-2: validate(screens, setups) メイン関数を実装（src/core/validator.ts）
  - 全 screen ID を Set に収集
  - 全 setup ID を Set に収集
  - 各チェック関数を呼び出し issues を蓄積
  - hasErrors = issues.some(i => i.level === 'error')
- [ ] 4-3: checkDuplicateScreenIds を実装
  - screen ID の出現回数をカウント → 2以上なら error
  - メッセージ例: `screen ID "home" が重複しています`
- [ ] 4-4: checkGivenReferences を実装
  - 全 case の given を走査 → setup ID の Set に存在しなければ error
  - given が string[] の場合は各要素をチェック
  - メッセージ例: `given "logged_in" → setup が見つからない`
- [ ] 4-5: checkNavigatesToReferences を実装
  - 全 case の navigates_to を走査 → screen ID の Set に存在しなければ error
  - メッセージ例: `navigates_to "settings" → screen が見つからない`
- [ ] 4-6: checkEmptyCases を実装
  - screen.cases.length === 0 なら warning
  - メッセージ例: `cases が空です`
- [ ] 4-7: checkErrorTypeMissing を実装
  - screen の cases に type: 'error' が1件もなければ warning
  - メッセージ例: `異常系 (type: error) が 0 件`
- [ ] 4-8: checkBoundaryTypeMissing を実装
  - screen の cases に type: 'boundary' が1件もなければ warning
  - メッセージ例: `境界値 (type: boundary) が 0 件`
- [ ] 4-9: ユニットテスト（src/core/validator.test.ts）
  - 各ルール（4-3〜4-8）の独立テスト（正常ケース / 違反ケース）
  - 複数エラーが同時に存在する場合の全件収集確認
  - 全件正常（issue 0件）のテスト
  - given が string 単体 / string[] の両パターン
  - navigates_to が undefined の場合（チェックスキップ）

## 完了条件
- `npm test -- src/core/validator.test.ts` が全テスト PASS
- 6つのチェックルールが全て実装・テスト済み
- 複数エラー同時存在時に全件収集されることが確認済み
