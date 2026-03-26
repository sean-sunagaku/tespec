# Unit Spec Extension Task Index

## Status Summary
- In progress: None
- Ready next: None
- Blockers: None

## Execution Order
1. TASK-01 Core schema/parser/validation 拡張
2. TASK-02 Generator/CLI generate 拡張
3. TASK-03 統合・fixtures・検証

## Tracker
| ID | Title | Status | Owner | Depends On | File | Notes |
|---|---|---|---|---|---|---|
| TASK-01 | Core Unit Parse And Validate | done | main | - | `.claude/arch-design/sessions/unit-spec-extension/tasks/TASK-01-core-unit-parse-validate.md` | schema, parser, unit-validator, validate command |
| TASK-02 | Unit Generators And Generate Command | done | main | - | `.claude/arch-design/sessions/unit-spec-extension/tasks/TASK-02-unit-generators-and-generate-command.md` | generator split, registry, generate command |
| TASK-03 | Integration Fixtures And Verification | done | main | TASK-01, TASK-02 | `.claude/arch-design/sessions/unit-spec-extension/tasks/TASK-03-integration-fixtures-and-verification.md` | merge, fixtures, integration tests, final verification |

## Active Blockers
- None

## Ready Queue
- None

## Done Log
- 2026-03-26 11:14: Task index created from `step4-architecture.md`.
- 2026-03-26 11:18: TASK-01 completed with focused core and validate tests passing.
- 2026-03-26 11:21: TASK-02 and TASK-03 completed after generator tests, integration tests, lint, and build all passed.
