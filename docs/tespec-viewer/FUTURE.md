# tespec viewer — 将来の機能（Phase 2: GUI 編集）

Phase 1（表示）の後に実装を検討する機能リスト。

## GUI 編集機能

### case の追加・編集・削除
- フォームで action / steps / expect / type を入力
- 編集内容を YAML ファイルに保存
- バリデーション結果をリアルタイム表示

### screen / unit の新規作成
- GUI でゼロから画面仕様・ユニット仕様を作成
- screen: ID、route、title を入力 → YAML 自動生成
- unit: ID、title、methods を入力 → YAML 自動生成

### ドラッグ&ドロップで並べ替え
- case の順序をドラッグで変更
- step の順序をドラッグで変更
- 変更を YAML に反映

### リアルタイムプレビュー
- 編集中に生成される YAML をライブ表示
- 分割ビュー（左: フォーム、右: YAML プレビュー）
