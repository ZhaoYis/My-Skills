import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=empty');
});

test('renders successful empty data as empty, not an error', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-state="empty"]')).toBeVisible();
  await expect(page.getByText('暂无可信数据')).toBeVisible();
  await expect(page.getByText('0%')).toHaveCount(0);
});

test('renders 401 with a re-login command', async ({ page, request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=unauthorized');
  await page.goto('/');
  await expect(page.locator('[data-state="unauthorized"]')).toBeVisible();
  await expect(page.getByRole('link', { name: '重新登录' })).toBeVisible();
});

test('renders 403 on the management page', async ({ page, request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=forbidden');
  await page.goto('/admin');
  await expect(page.locator('[data-state="forbidden"]')).toBeVisible();
  await expect(page.getByText('无权访问')).toBeVisible();
});

test('renders server and connection failures with retry', async ({ page, request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=server');
  await page.goto('/');
  await expect(page.locator('[data-state="unavailable"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();

  await request.get('http://127.0.0.1:4101/__scenario?value=network');
  await page.goto('/');
  await expect(page.locator('[data-state="unavailable"]')).toBeVisible();
});

test('prevents duplicate management submission and reports success or failure', async ({ page, request }) => {
  await page.goto('/admin');
  const button = page.getByRole('button', { name: '全部采集' });
  await button.click();
  await expect(page.getByRole('status')).toHaveText('采集任务已排队');

  await request.get('http://127.0.0.1:4101/__scenario?value=mutation-error');
  await page.reload();
  await page.getByRole('button', { name: '全部采集' }).click();
  await expect(page.getByRole('status')).toHaveText('采集任务提交失败');
});
