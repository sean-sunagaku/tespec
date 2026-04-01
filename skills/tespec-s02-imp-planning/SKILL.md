---
name: tespec-s02-imp-planning
description: >
  tespec ワークフロー Step 2/4。設計や ToDo を最初から screen / unit / workflow に
  落ちやすい形で組み立てるスキル。tespec-s01-spec-planning で固めた要件・方向性を受け取り、
  tespec YAML にしやすい inventory、実装 task と test artifact が対になった phase plan、
  tespec backlog を作る。
  Use when: 設計を先に考えたい、tespec を作りやすくしたい、screen/unit/workflow に分けたい、
  ToDo を整理したい、実装計画を立てたい、テスト駆動で計画したい。
  方向性が固まっていて実装計画を作りたい場合に使う。まだ「何を作るか」が曖昧なら
  先に tespec-s01-spec-planning を使う。
---

# Tespec Imp Planning

設計や ToDo を、後から無理やり tespec に変換するのではなく、最初から `screen` / `unit` / `workflow` に落ちやすい形で組み立てるスキル。

前提として、何を作るか・誰のためか・方向性・主要な責務分離・採用ライブラリがある程度決まっている状態を想定する。そこが曖昧なら、先に `tespec-s01-spec-planning` を使う。

## 決めること

| この skill で決める                    | 前提にするもの（tespec-s01-spec-planning の出力） |
|--------------------------------------|-------------------------------------------|
| screen inventory                      | feature summary                            |
| unit inventory                        | direction memo                             |
| workflow inventory                    | architecture summary                       |
| setup candidates                      | ownership map                              |
| tespec backlog                        | rough phases                               |
| testable phase plan                   |                                            |
| implementation と test artifact の対応 |                                            |

前提がまだ曖昧なら、この skill で無理に詰めず `tespec-s01-spec-planning` に戻る。

## 出力

- feature summary の再確認
- screen inventory
- unit inventory
- workflow inventory
- setup candidates
- phase plan
- tespec backlog

各テンプレートは `references/planning-checklists.md` にある。

## Planning Workflow

### 1. 機能の境界を固定する

最初に以下を短く決める。

- 何を作るか / 何を作らないか
- 誰がどこで使うか
- どの入出力や外部依存があるか

ここが曖昧なまま画面や API を列挙し始めない。

### 2. screen / unit / workflow の候補を出す

以下の基準で分ける。

| 種別 | 基準 |
|---|---|
| `screen` | ユーザーから見える安定した UI 面。route、modal、major panel state、wizard step を含む |
| `unit` | 1 つの責務を持つロジックやファイル境界。owner（core / server / web）を明記する |
| `workflow` | 複数 screen や複数層にまたがる 1 本の操作パス |
| `setup` | 複数 case で繰り返す前提条件 |

### 3. 4 層で case を洗い出す

各 screen や unit に対して、少なくとも次の 4 層を確認する。

1. **ユーザー操作** — 表示・入力・実行・遷移・更新
2. **異常系と境界値** — 必須欠落、不正入力、0 件、上限、空文字
3. **入力データ破損** — file not found、malformed data、invalid schema、missing config
4. **ランタイム結合点** — UI→core、web→server、server→provider、save→reload 一貫性

この 4 層を埋める前に phase や ToDo を確定しない。

### 4. ToDo を test artifact とセットで書く

実装タスクだけを書くのではなく、対応する tespec と test file を並べる。

**例:**

| 種別 | パス |
|---|---|
| implementation | `packages/core/src/application/apply-operations.ts` |
| tespec | `docs/tespec/units/core/apply-operations.yaml` |
| tests | `tests/units/core/apply-operations.test.ts` |

### 5. tespec にしにくい設計を早めに見つける

以下の匂いがあれば、設計を戻して直す。

- UI state と domain rule が分離されていない
- 1 case に複数 action が混ざる
- route や handler にロジックが直書きされている
- setup にすべき前提が各 case に重複している
- workflow が分岐だらけで 1 本のパスになっていない

## Domain-Specific Heuristics

プロダクトの特性に応じて、以下のパターンを意識する。

**キャンバス系・エディタ系:**
- 画面を route 数で数えず、ユーザーが認識する作業面で数える
- 操作中の一時 state と確定後の state を分ける
- view layer のロジックと core の rule を分ける

**AI / MCP 連携がある場合:**
- AI や MCP は UI と別 entrypoint だが、同じ use case を呼ぶ前提で切る
- HTTP / MCP parity は workflow として先に確保する

**ファイルベースのツール:**
- save / load の一貫性は workflow として先に確保する

## Handoff to Implementation

この skill の出口は、次の 3 つが揃った状態。

- tespec YAML にしやすい inventory
- 実装 task と test artifact が対になった phase plan
- `docs/tespec` に起こす優先順位

## When to Read References

以下が必要なら `references/planning-checklists.md` を読む。

- screen / unit / workflow の切り方に迷う
- phase plan を testable にしたい
- tespec backlog の表をそのまま使いたい
- 異常系・境界値・結合点の観点を漏らしたくない
