# Spec Architecture Checklists

## 1. Product Summary Template

```md
## Product Summary
- what:
- who:
- why:
- success:
- non-goals:
```

## 2. Requirement Framing Template

```md
## Requirements
- goals:
- non-goals:
- users:
- usage context:
- constraints:
- external dependencies:
- main flows:
- major failure modes:
```

## 3. Direction Memo Template

```md
## Direction Memo
- product direction:
- UX principle:
- local-first / server-first:
- AI usage policy:
- MCP relevance:
- rollout strategy:
```

## 4. Architecture Summary Template

```md
## Architecture Summary
- frontend responsibility:
- backend responsibility:
- core/shared responsibility:
- persistence source of truth:
- integration boundaries:
- future extension points:
```

## 5. Library Decision Table

```md
| area | candidates | chosen | why chosen | why not chosen |
|---|---|---|---|---|
```

### 比較観点

- product fit
- license
- delivery speed
- testability
- long-term maintainability

## 6. Ownership Map Template

```md
| concern | owner | notes |
|---|---|---|
```

### owner の分類

| owner | 責務 |
|---|---|
| `web` | rendering, DOM events, temporary UI state |
| `server` | file I/O, provider API, transport, settings |
| `core` | schema, domain rule, operation, use case, validation |

## 7. Rough Phase Plan Template

```md
| phase | goal | enables | not yet included |
|---|---|---|---|
```

## 8. Tespec Handoff Template

```md
## Tespec Handoff
- stable UI surfaces:
- candidate units:
- candidate workflows:
- shared setups:
- error hotspots:
- boundary hotspots:
- integration hotspots:
```

## 9. Handoff Quality Checklist

- [ ] 何を作るかが 1 段落で説明できる
- [ ] goals と non-goals が分かれている
- [ ] users と usage context がある
- [ ] library decision に採用理由と不採用理由がある
- [ ] FE / BE / core の ownership がある
- [ ] rough phases が dependency chain になっている
- [ ] 次に screen / unit / workflow を切る材料がある

## 10. Smell Checklist

以下が見えたら設計を戻す。

- 何を作るかが 1 段落で説明できない
- goals と solution が混ざっている
- library 選定理由が「なんとなく便利そう」だけ
- FE / BE / core の責務が重なっている
- 将来の拡張を入れるのに route/handler 直書きが前提
- phase plan が dependency chain ではなく作業メモになっている
- handoff しても screen / unit / workflow を切れなさそう
