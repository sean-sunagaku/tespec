# Planning Checklists

## 1. Feature Framing Template

```md
## Feature Summary
- goal:
- non-goals:
- user:
- main flow:
- external dependencies:
```

## 2. Screen Inventory Template

```md
| screen id | title | route/trigger | purpose | main actions | error/boundary focus | navigates_to |
|---|---|---|---|---|---|---|
```

### screen の切り方

| パターン | screen にする？ |
|---|---|
| route が違う | 基本は別 screen |
| modal で独立した操作面 | screen 候補 |
| panel / tab | case で十分なことが多い |
| route ではなく major UI state で切り替わる | screen にしてよい |

## 3. Unit Inventory Template

```md
| unit id | owner | file/module | responsibility | inputs | outputs | error sources | boundary focus |
|---|---|---|---|---|---|---|---|
```

### owner の分類

| owner | 責務 |
|---|---|
| `web` | DOM event、viewport、一時編集中 state |
| `server` | route、filesystem、provider API、transport |
| `core` | schema、operation、use case、validation、domain rule |

## 4. Workflow Inventory Template

```md
| workflow id | goal | start setup | path | success result | failure branch |
|---|---|---|---|---|---|
```

### workflow の切り方

- 1 workflow = 1 本のパス
- 分岐があるなら別 workflow に分ける
- 層またぎ（save/reload、AI apply、HTTP/MCP parity）を優先して取る

## 5. Setup Candidate Template

```md
| setup id | reused by | steps |
|---|---|---|
```

### setup に寄せるもの

- ログイン済み
- project 作成済み
- データがロード済み
- API key 設定済み
- fixture 読込済み

## 6. 4-Layer Case Checklist

各 screen と unit で次の 4 層を確認する。

### Layer 1: User Action

- 表示
- 入力
- 実行
- 遷移
- 更新

### Layer 2: Error and Boundary

- 必須入力欠落
- 不正入力
- 0 件
- 上限
- 空文字
- 極端に長い値

### Layer 3: Broken Inputs and Prerequisites

- file not found
- malformed data
- invalid schema
- missing config
- missing env
- missing API key

### Layer 4: Runtime Integration

- UI → core
- web → server
- server → provider
- HTTP → MCP parity
- save → reload consistency

## 7. Testable Phase Plan Template

```md
## Implementation Tasks
- [ ] ...

## Tespec Artifacts
- [ ] docs/tespec/screens/...
- [ ] docs/tespec/units/...
- [ ] docs/tespec/workflows/...

## Test Code Artifacts
- [ ] tests/screens/...
- [ ] tests/units/...
- [ ] tests/workflows/...

## Acceptance
- [ ] ...

## Verification
- [ ] tespec validate warning 0
- [ ] unit / component / integration / e2e ...
```

## 8. Handoff Input Checklist

tespec-s01-spec-planning からの引き継ぎに以下があるか確認する。

- [ ] 何を作るかが短く説明されている
- [ ] rough phases がある
- [ ] ownership map がある
- [ ] external dependencies が見えている
- [ ] main flow が 1 本以上見えている

足りなければ tespec-s01-spec-planning に戻る。

## 9. Smell Checklist

設計段階で次が見えたら戻る。

- screen の action が長文で 2 操作以上入っている
- unit が UI と domain rule を両方持つ
- workflow が実質 2 本以上のフローを含む
- setup 候補が繰り返し登場している
- 例外系が「後で考える」になっている
- phase plan に tespec artifact がない
- phase plan に verification がない
