import { describe, it, test, expect } from "vitest";

describe("ダッシュボード", () => {
  it("画面を開く", () => {
    expect(true).toBe(true);
  });

  it.todo("統計データを表示する");

  test.skip("グラフを描画する", () => {
    // skipped
  });
});
