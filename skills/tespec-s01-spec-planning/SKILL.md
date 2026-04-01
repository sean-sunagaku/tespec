---
name: tespec-s01-spec-planning
description: >
  tespec ワークフロー Step 1/4。曖昧なアイデアや要求を、tespec に落としやすい
  要件定義・設計方針へ変換する上流スキル。「何を作るか」「誰のためか」「方向性」
  「ライブラリ選定」「責務分離」「rough phase」を決める。
  screen / unit / workflow への分解はまだ行わず、tespec-s02-imp-planning へ渡す handoff を作る。
  Use when: 要件定義したい、何を作るか決めたい、方向性を決めたい、ライブラリ選定したい、
  責務分離を考えたい、アーキテクチャを検討したい、設計の初期段階を整理したい。
  まだ「何を作るか」が曖昧な段階で使う。方向性が固まっていて実装計画を作りたい場合は
  tespec-s02-imp-planning を使う。
---

# Tespec Spec Planning

曖昧なアイデアや要求を、tespec に落としやすい要件定義・設計方針へ変換する上流スキル。

この skill は「何を作るか」を固める。`screen` / `unit` / `workflow` への分解は行わず、次の `tespec-s02-imp-planning` へ渡す前提で整理する。

## 決めること

| この skill で決める             | まだ決めない（tespec-s02-imp-planning の役割） |
|-------------------------------|----------------------------------------|
| 何を作るか / 誰のためか          | screen ごとの case                      |
| goals / non-goals              | unit ごとの case                        |
| main flow と major failure modes | workflow ごとの操作列                   |
| FE / BE / core の責務分離       | tespec backlog                         |
| ライブラリ選定                   | test file 単位の ToDo                  |
| rough implementation phases     |                                        |

## 入力

- 思いついている機能やアイデア
- 使う人のイメージ
- 制約や使いたい技術
- 避けたい選択肢

断片的でよい。足りない場合は goal / user / constraints / non-goals を優先して埋める。

## 出力

- product summary
- requirements summary
- direction memo
- architecture summary
- library decision table
- ownership map
- rough phases
- tespec handoff notes

各テンプレートは `references/spec-architecture-checklists.md` にある。

## Workflow

### 1. Feature Framing

最初に以下を 1 段落で言えるレベルまで短くする。

- 何を作るか
- 誰のためか
- 何が嬉しいのか
- 今回は何をやらないか

ここが曖昧なままライブラリ選定やファイル構成に進まない。

### 2. Requirement Framing

次を整理する。

- goals / non-goals
- user and context
- constraints
- external dependencies
- main flows
- failure modes

この時点で「UI の話か」「domain rule の話か」「integration の話か」をざっくり分ける。

### 3. Architecture Direction

アーキテクチャは理論ではなく、今回の制約に対して最小の構成を選ぶ。少なくとも以下を決める。

- state の正本をどこに置くか
- FE / BE / core の責務分離
- 外部 API や file I/O をどこに閉じ込めるか
- 将来の拡張点（MCP、AI 連携など）をどう残すか

### 4. Library Decisions

便利そうかどうかではなく、以下の観点で比較する。

- product fit
- license and commercial fit
- implementation speed
- testability
- long-term maintainability
- migration cost

選ばない理由も短く残す。

### 5. Rough Phase Planning

詳細 task ではなく、実装の dependency chain を切る。

例: foundation → editor → AI integration → MCP integration

各 phase で「何が testable になるか」を 1 行で添える。

### 6. Handoff

この skill の出口は、次を含む handoff。

- feature summary
- direction memo
- architecture summary
- library decisions
- ownership map
- rough implementation phases

これが揃ったら、screen / unit / workflow 分解は `tespec-s02-imp-planning` に渡す。

## Tespec-first Heuristics

上流設計の時点から、後で tespec に落としやすい設計を意識する。

- 後で `screen` に切れない UI 面を増やしすぎない
- 後で `unit` に切れない責務の混在を作らない
- 後で `workflow` に切れない曖昧な main flow を残さない
- goals と acceptance criteria を分けておく
- architecture decision は「どの test に効くか」の視点で評価する

## When to Read References

以下が必要なら `references/spec-architecture-checklists.md` を読む。

- requirements を短い形で整理したい
- library decision table のテンプレートが欲しい
- ownership map を作りたい
- rough phase plan と tespec handoff をまとめたい
