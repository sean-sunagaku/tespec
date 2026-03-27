import { expect, test } from '@playwright/test';

test.describe('ログイン画面', () => {
  test('画面を開く', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('form')).toBeVisible();
  });

  test('誤った資格情報で送信する', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'wrong@example.com');
    await page.click('button[type=submit]');
    await expect(page.locator('.error')).toBeVisible();
  });
});
