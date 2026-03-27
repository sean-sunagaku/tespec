# Spec-Test 整合性チェック

tespec YAML 仕様とテストファイルの対応関係を検証するメタテスト。
YAML の case が勝手に消されたり、テストファイルが抜け落ちたりしていないかを自動検出する。

## なぜ必要か

TDD で「YAML → テスト → 実装」の順に進めると、以下のリスクがある:
- YAML に case を追加したのにテストを書き忘れた
- テストファイルを誤って削除した
- YAML の case を削除したのにテストが残っている（孤立テスト）
- リファクタリングでテスト名を変えた結果、YAML との対応が切れた

このメタテストを CI に含めることで、仕様とテストの乖離を早期検出できる。

## 検証する3項目

### 1. YAML → テストファイルの存在確認

全ての YAML screen spec に対応する `.test.ts` ファイルが存在するか。

```typescript
it('全ての YAML screen spec に対応するテストファイルが存在する', async () => {
  const yamlFiles = (await readdir(specsDir)).filter(f => f.endsWith('.yaml'));
  const testFiles = (await readdir(testsDir)).filter(f => f.endsWith('.test.ts'));

  for (const yaml of yamlFiles) {
    const screenId = basename(yaml, '.yaml');
    expect(testFiles).toContain(`${screenId}.test.ts`);
  }
});
```

### 2. YAML case → テスト内容の存在確認

各 YAML の `action` 文字列がテストファイル内に含まれているか。

```typescript
it('全ての YAML case が対応するテストファイル内に存在する', async () => {
  for (const yamlFile of yamlFiles) {
    const data = parseYaml(yamlFile);
    const testContent = await readFile(testFilePath, 'utf8');

    for (const caseItem of data.cases) {
      expect(testContent).toContain(caseItem.action);
    }
  }
});
```

### 3. テストファイル → YAML の孤立チェック

テストファイルに対応する YAML spec が存在するか（孤立テストの検出）。

```typescript
it('テストファイルが YAML spec なしに孤立していない', async () => {
  const yamlScreenIds = new Set(yamlFiles.map(f => basename(f, '.yaml')));

  for (const testFile of viewerTestFiles) {
    const screenId = basename(testFile, '.test.ts');
    expect(yamlScreenIds.has(screenId)).toBe(true);
  }
});
```

## 除外対象

以下のテストファイルはメタテストの対象から除外する:
- `*-watcher.test.ts` — 統合テスト（YAML screen spec との対応なし）
- `*-spec-coverage.test.ts` — メタテスト自身
- `helpers.ts` — テストヘルパー（テストファイルではない）

## ファイル配置

```
tests/<feature>/
├── <screen-a>.test.ts            # YAML spec と 1:1 対応
├── <screen-b>.test.ts
├── <feature>-watcher.test.ts     # 統合テスト（除外対象）
├── <feature>-spec-coverage.test.ts  # このメタテスト
└── helpers.ts
```

## テスト実行

```bash
# メタテストだけ実行（CI で spec が足りているか確認）
pnpm test -- tests/<feature>/<feature>-spec-coverage.test.ts

# 全テスト
pnpm test -- tests/<feature>/
```

## いつ追加するか

- **Phase 2（テスト実装）完了時**: 全テストを書き終えたら追加する
- **既存プロジェクト**: YAML spec を後から追加した場合に、テスト漏れを防ぐ目的で追加
