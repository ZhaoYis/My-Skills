import { expect, test } from '@playwright/test';

test('shows a recoverable sign-in state after an OIDC or session exchange failure', async ({ page }) => {
  await page.goto('/signin?error=CallbackRouteError');
  await expect(page.getByRole('heading', { name: '进入能效控制台' })).toBeVisible();
  await expect(page.getByText('登录未完成，请重新验证域账号。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '域账号登录' })).toBeVisible();
});
