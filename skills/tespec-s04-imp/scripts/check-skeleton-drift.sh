#!/bin/bash
# tespec スケルトン構造の変更をブロックする PreToolUse Hook
#
# PreToolUse で Edit/Write をインターセプトし、テストファイルの
# describe/it 構造を変更する操作を exit 2 で拒否する。
#
# 環境変数:
#   TOOL_NAME         — 使用されるツール名 (Edit / Write)
#   TOOL_INPUT        — ツールの入力パラメータ (JSON)
#
# Exit codes:
#   0 — 許可（変更なし or テストファイル以外）
#   2 — 拒否（スケルトン構造の変更を検出）
#
# 使い方:
#   settings.json の hooks に以下を追加:
#   {
#     "hooks": {
#       "PreToolUse": [
#         {
#           "matcher": "Edit|Write",
#           "command": "bash /path/to/check-skeleton-drift.sh"
#         }
#       ]
#     }
#   }

# jq が必要
if ! command -v jq &> /dev/null; then
  exit 0
fi

# ツール入力から file_path を取得
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# テストファイル以外は無視
if [[ ! "$FILE_PATH" =~ \.test\.(ts|tsx)$ ]] && [[ ! "$FILE_PATH" =~ \.spec\.(ts|tsx)$ ]]; then
  exit 0
fi

# --- Edit ツールの場合 ---
if [ "$TOOL_NAME" = "Edit" ]; then
  OLD_STRING=$(echo "$TOOL_INPUT" | jq -r '.old_string // empty')
  NEW_STRING=$(echo "$TOOL_INPUT" | jq -r '.new_string // empty')

  # old_string に describe/it が含まれているか
  OLD_HAS_SKELETON=$(echo "$OLD_STRING" | grep -cE '^\s*(describe|it)\(')
  NEW_HAS_SKELETON=$(echo "$NEW_STRING" | grep -cE '^\s*(describe|it)\(')

  if [ "$OLD_HAS_SKELETON" -gt 0 ] || [ "$NEW_HAS_SKELETON" -gt 0 ]; then
    # old と new の describe/it 行を抽出して比較
    OLD_LINES=$(echo "$OLD_STRING" | grep -E '^\s*(describe|it)\(' | sed 's/^[[:space:]]*//')
    NEW_LINES=$(echo "$NEW_STRING" | grep -E '^\s*(describe|it)\(' | sed 's/^[[:space:]]*//')

    if [ "$OLD_LINES" != "$NEW_LINES" ]; then
      echo ""
      echo "BLOCKED: tespec スケルトン構造の変更を検出しました"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "ファイル: $FILE_PATH"
      echo ""
      echo "describe/it のタイトル・構造・順序は YAML が正本です。"
      echo "テスト実装時に変更してはいけません。"
      echo ""
      echo "変更が必要な場合は:"
      echo "  1. tespec-s03-yaml-gen で YAML を先に修正する"
      echo "  2. tespec validate で確認する"
      echo "  3. YAML diff → テスト同期の手順でスケルトンを更新する"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      exit 2
    fi
  fi
fi

# --- Write ツールの場合（全書き換え）---
if [ "$TOOL_NAME" = "Write" ]; then
  # 既存ファイルが存在する場合のみチェック
  if [ -f "$FILE_PATH" ]; then
    CONTENT=$(echo "$TOOL_INPUT" | jq -r '.content // empty')

    # 既存ファイルと新しいコンテンツの describe/it 行を比較
    OLD_LINES=$(grep -E '^\s*(describe|it)\(' "$FILE_PATH" | sed 's/^[[:space:]]*//')
    NEW_LINES=$(echo "$CONTENT" | grep -E '^\s*(describe|it)\(' | sed 's/^[[:space:]]*//')

    if [ "$OLD_LINES" != "$NEW_LINES" ]; then
      echo ""
      echo "BLOCKED: テストファイルの全書き換えでスケルトン構造が変わります"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "ファイル: $FILE_PATH"
      echo ""
      echo "Write ではなく Edit を使い、// TODO: implement の中身だけを変更してください。"
      echo "describe/it の構造を変更する必要がある場合は:"
      echo "  1. tespec-s03-yaml-gen で YAML を先に修正する"
      echo "  2. tespec validate で確認する"
      echo "  3. YAML diff → テスト同期の手順でスケルトンを更新する"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      exit 2
    fi
  fi
fi

exit 0
