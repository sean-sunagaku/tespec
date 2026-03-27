# Devil's Advocate Feedback: E2E Workflow Feature

## 批判 1: navigates_to で遷移フローは表現できないか？

```
[問題の種類: YAGNI 違反 / 重複機能]

現在の設計が前提としていること: 画面遷移フローを記述するには専用の Workflow spec タイプが必要
この前提が崩れる状況: 既存の CaseSchema に navigates_to があり、遷移先を型安全に参照できる
より単純な代替設計: 複数 Screen の navigates_to をたどることでフローグラフは構築できる
リスク: Workflow spec を追加すると「遷移の定義が Screen と Workflow の二箇所に存在する」状態になる / 重大度: 重要
```

### 根拠

現在の Screen YAML:
```yaml
screen: login
cases:
  - action: "新規登録リンクをタップ"
    steps: ["新規登録リンクをタップ"]
    expect: "サインアップ画面に遷移する"
    navigates_to: signup
```

Workflow YAML:
```yaml
workflow: user_registration
steps:
  - screen: login
    action: "新規登録リンクをタップ"
  - screen: signup
    action: "必要事項を入力して登録"
  - screen: home
    expect: "ようこそメッセージが表示される"
```

**本質的問題**: Workflow の `steps` は Screen の `cases[].navigates_to` チェーンを手動でトレースしたものと同じ情報。バリデーション時に「Workflow の screen 参照が実際の navigates_to と矛盾していないか」という照合が必要になる。これは新しい整合性維持コストを生む。

**代替案**: `tespec view` にフロー可視化機能を追加し、navigates_to グラフを自動描画する方向で検討する価値がある。

---

## 批判 2: WorkflowStep の `action/expect` フィールドが将来肥大化するリスク

```
[問題の種類: 過剰設計の種を蒔く可能性]

現在の設計が前提としていること: WorkflowStep は screen + action + expect だけで十分
この前提が崩れる状況: E2E テストフレームワーク固有の機能（given, not_expect, type）を Workflow ステップに入れたい要望が来る
より単純な代替設計: WorkflowStep は screen 参照のみにし、action/expect は参照先 Screen の Case から継承する
リスク: 今 action/expect を WorkflowStep に持たせると、将来 given/type も追加されて「Screen Case の劣化コピー」になる / 重大度: 軽微（ただし要注意）
```

### 根拠

Screen の CaseSchema は現在 7 フィールド（action, expect, steps, given, target, type, not_expect）。Workflow step に action と expect だけ持たせると、残りのフィールドが必要になった時点で WorkflowStep が CaseSchema をほぼコピーした構造になる。

設計の境界を明確にするなら二択:
1. **参照モデル**: WorkflowStep は `screen` と `case_action` の参照だけ持つ（Screen Case を参照して詳細は委譲）
2. **独立モデル（現在の方向）**: WorkflowStep は独自フィールドを持つ（CaseSchema との分岐を明示的に受け入れる）

今の設計方針は (2) だが、境界を決めずに「必要になったら追加」を繰り返すと (1) でも (2) でもない中途半端な構造になる。

---

## 批判 3: Playwright Generator の追加は本当に必要か

```
[問題の種類: YAGNI 違反]

現在の設計が前提としていること: Workflow spec から Playwright テストスケルトンを生成する
この前提が崩れる状況: Playwright の E2E テストは画面遷移が前提であり、Workflow フローを素直に変換できる
                    ─ が、実際の Playwright コードは page.goto / page.click / expect の組み合わせで
                    Workflow YAML からの自動生成コードの有用性は不明
より単純な代替設計: Generator なし、Workflow は「仕様書」として Viewer に表示するだけにとどめる MVP
リスク: Generator を作ると「生成されたコードが現実のシナリオに合わない」という問題が実運用で発覚しやすい / 重大度: 重要
```

### 根拠

現在の Screen Generator が生成するのは「TODOコメント付きのスケルトン」であり、実装者が中身を書く前提。Workflow も同様のスケルトン生成なら価値はある。しかし、Workflow は複数 Screen にまたがるため:

- 各ステップで「どの画面のどの状態から始まるか」を Playwright のコード上で表現する必要がある
- Setup（given）との関係が Screen 単位では明確だったが、Workflow 単位では曖昧になる
- `page.waitForNavigation()` のような E2E 固有の制御フローが step 定義にない

**推奨**: まず Viewer での Workflow フロー表示（ステップ一覧・画面遷移矢印）を MVP として実装し、Generator は Viewer の有用性が確認できてから追加する。

---

## 批判 4: `workflows_dir` を optional にする判断の妥当性

```
[問題の種類: 設計一貫性の問題]

現在の設計が前提としていること: workflows_dir は optional にする（units_dir と同じパターン）
この前提が崩れる状況: units_dir は optional で実績がある。パターンとして正しい
より単純な代替設計: optional は正しい。問題は「ディレクトリが存在するが空の場合のハンドリング」
リスク: 低い。ただし ConfigSchema の optional フィールドが増え続けると可読性が下がる / 重大度: 軽微
```

### 根拠

現在 ConfigSchema に optional フィールドは `units_dir` の 1 つ。Workflow 追加で 2 つになる。`screens_dir` と `setups_dir` は required（デフォルト値あり）という非対称な構造が続く。

長期的には「spec タイプを追加するたびに ConfigSchema に optional フィールドを追加する」というパターンが定着してしまい、ConfigSchema が spec タイプ一覧の反射的な拡張先になる。

将来的には:
```yaml
specs:
  screens: ./screens
  setups: ./setups
  units: ./units
  workflows: ./workflows  # 存在する spec タイプをまとめて定義
```
のような統合構造の方がスケールするが、現時点で移行するのは過剰。**現状パターンの踏襲は合理的**だが、3種類目（Workflow）追加時点でこの問題を認識しておくことが重要。

---

## 批判 5: Viewer コンポーネントの追加によるメンテナンスコスト

```
[問題の種類: 複雑化コスト]

現在の設計が前提としていること: Viewer に WorkflowCard コンポーネントを追加する
この前提が崩れる状況: Viewer は現在 Preact + Tailwind の単純な構成。新コンポーネントは負担だが小さい
より単純な代替設計: Workflow は「ステップリスト」として、既存の ScreenCard に類似した構造で実装可能
リスク: 低い。ただし「フロー図（矢印付き遷移）」を実装しようとすると一気に複雑化する / 重大度: 軽微（ただし範囲次第）
```

### 根拠

Viewer の server.ts では `/api/specs` エンドポイントが `screens/setups/units` を返している。Workflow 追加で 4 番目のフィールドが加わる。API の変更自体は小さい。

**注意点**: Workflow をフロー図として可視化したい場合（矢印・遷移グラフ）は、SVG/Canvas ライブラリか CSS Grid での実装が必要になり、**これが最大の複雑化リスク**。ステップリスト（番号付きリスト）で十分なら WorkflowCard は ScreenCard の簡略版で済む。

**推奨**: MVP は番号付きステップリスト表示のみ。フロー図は別フェーズ。

---

## 批判 6: テスト負荷の許容範囲

```
[問題の種類: 実装コスト]

現在の設計が前提としていること: 既存パイプラインに乗るため、テスト追加は許容範囲
この前提が崩れる状況: 既存のテストファイル構成を確認すると schema.test.ts / parser.test.ts / validator.test.ts /
                    generator*.test.ts と spec タイプごとにテストが肥大化している
より単純な代替設計: テスト戦略の見直しは不要。ただし Workflow 追加で増えるテスト量を事前に見積もる
リスク: 中程度。generator.test.ts が既に複数ファイルに分割されており、workflow 用テストも相当量になる / 重大度: 軽微
```

### 根拠

既存テストの確認（Glob 結果より）:
- `generator.test.ts`, `generator-xctest.test.ts`, `generator-vitest.test.ts`, `generator-screen-vitest.test.ts`, `generator-unit-xctest.test.ts`

テストファイルがターゲット×spec タイプの組み合わせで増えていく傾向がある。Workflow に Playwright generator を追加する場合、`generator-workflow-playwright.test.ts` が少なくとも 1 つ追加される。これは許容範囲だが、「generators を増やすたびにテストファイルが追加される」構造の固定化を意識する必要がある。

---

## 批判 7: 最もシリアスな問題 ─ Screen YAML と Workflow YAML の整合性維持

```
[問題の種類: 整合性維持コスト / 長期メンテナンスリスク]

現在の設計が前提としていること: Workflow の steps が screen 参照を持つ → バリデーション時に screen 存在確認をする
この前提が崩れる状況: Workflow が参照する Screen の Case（action）が変更されても Workflow 側は更新されない
より単純な代替設計: Workflow step から action 参照を取り除き、screen 参照のみにする
リスク: 「Workflow の action が Screen の実際の Case action と一致しない」状態がサイレントに起きる / 重大度: 重要
```

### 根拠

Workflow YAML の `action` フィールドはフリーテキスト:
```yaml
steps:
  - screen: login
    action: "新規登録リンクをタップ"  ← Screen の case[].action と独立した自由記述
```

一方、Screen YAML に:
```yaml
cases:
  - action: "新規登録リンクをタップ"  ← 同じ文字列だが別管理
```

この二重管理は以下のリスクを生む:
1. Screen の case action を「新規登録ボタンをタップ」に変更した場合、Workflow の action は古いまま
2. バリデーターは「Workflow の action と Screen の case action が一致するか」を検証できない（フリーテキスト比較は脆弱）
3. 結果として Workflow は「参照関係のある仕様書」ではなく「独立した説明文」になってしまう

**対策案**: Workflow step は `screen` + `case_action` の参照（完全一致）か、`screen` のみ（action は省略）にする。どちらの方針を取るかを事前に決定する必要がある。

---

## 総合判定

| 観点 | リスク評価 | 推奨アクション |
|---|---|---|
| navigates_to との重複 | **重要** | 「Workflow が何を追加するか」の価値を再確認 |
| WorkflowStep の肥大化 | 軽微（注意） | CaseSchema 流用か独立かの境界を明示的に決める |
| Playwright Generator の即時追加 | **重要** | MVP では Generator なし → Viewer 表示のみ |
| workflows_dir optional | 軽微 | 現パターン踏襲で許容。Config 設計の将来課題として記録 |
| Viewer コンポーネント追加 | 軽微 | フロー図は別フェーズ。ステップリストのみで MVP |
| テスト負荷 | 軽微 | 許容範囲内。Generator 追加時に 1 ファイル増える程度 |
| Screen-Workflow 整合性 | **最重要** | action をフリーテキストにするか screen 参照にするか方針決定が必須 |

### 最もシンプルな MVP パス（YAGNI 準拠）

1. **WorkflowSchema**: `screen` 参照 + `action`（フリーテキスト、任意）+ `expect`（任意）
2. **Parser**: 既存の `parseYamlDirectory` パターンをそのまま再利用
3. **Validator**: `steps[].screen` の Screen ID 参照チェックのみ（action の整合性チェックは Phase 2）
4. **Generator**: **Phase 1 では追加しない**。Viewer での表示確認後に判断
5. **Viewer**: WorkflowCard をステップリストとして追加（フロー図は Phase 2）
6. **Config**: `workflows_dir` を optional で追加（units_dir パターンを踏襲）

### 「やらなくていいこと」リスト

- Phase 1 での Playwright/XCTest Generator 追加
- WorkflowStep への given/type/not_expect の拡張
- フロー図（矢印付きグラフ）の Viewer 実装
- Screen Case の action との整合性バリデーション（フリーテキスト比較は信頼性が低い）
- Workflow 専用の汎用 spec 拡張機構の設計
