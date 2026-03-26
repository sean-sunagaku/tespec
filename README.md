# tespec

`tespec` は、YAML で定義した画面仕様とクラス単位の Unit 仕様を検証し、テストスケルトンを生成する TypeScript CLI です。画面ごとの操作と期待値、メソッドごとのユースケースを先に整理し、テスト漏れを減らすことを目的にしています。

## インストール

グローバルに使う場合:

```bash
npm install -g @sean-sunagaku/tespec
```

単発で使う場合:

```bash
npx @sean-sunagaku/tespec validate -c docs/tespec/config.yaml
```

## 使い方

YAML のサンプルは `docs/tespec/` にあります。

```bash
npx tespec validate -c docs/tespec/config.yaml
```

```bash
npx tespec generate -c docs/tespec/config.yaml --dry-run
```

`generate` をファイル出力で使うと、既定では `tests/` 配下に Screen Spec 用の Playwright スケルトンと Unit Spec 用の Vitest スケルトンを生成します。

出力先を変えたい場合は `--out-dir` を使えます。

```bash
npx tespec generate -c docs/tespec/config.yaml --out-dir tests/generated
```

Unit Spec の生成ターゲットを切り替えたい場合は `--unit-target` を使えます。

```bash
npx tespec generate -c docs/tespec/config.yaml --unit-target xctest
```

## YAML の書き方

YAML の仕様と記述ガイドは [docs/tespec-design.md](docs/tespec-design.md) を参照してください。

## License

MIT
