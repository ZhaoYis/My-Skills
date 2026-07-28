import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=team');
});

test('selects a visible team and navigates sorted, filtered, paginated member metrics', async ({ page }) => {
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: '开发能效脉搏' })).toBeVisible();
  await expect(page.getByLabel('可见团队')).toHaveValue('1');
  await expect(page.getByRole('heading', { name: '成员明细' })).toBeVisible();
  await expect(page.getByText('12 MEMBERS')).toBeVisible();

  await page.getByLabel('成员排序').selectOption('completedRuns');
  await page.getByLabel('排序方向').selectOption('desc');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect(page.locator('.member-table tbody tr').first()).toContainText('Alice');

  await page.getByRole('link', { name: '下一页' }).click();
  await expect(page.getByText('2 / 2')).toBeVisible();
  await expect(page.getByRole('link', { name: '上一页' })).toBeVisible();
  await page.getByRole('link', { name: '上一页' }).click();

  await page.getByLabel('搜索成员').fill('alice@example.test');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect(page.getByRole('link', { name: 'Alice' })).toBeVisible();
  await expect(page.getByText('Pending User')).toHaveCount(0);
  await expect(page).toHaveURL(/q=alice%40example\.test/);
  await page.waitForLoadState('networkidle');
  const aliceLink = page.getByRole('link', { name: 'Alice' });
  await expect(aliceLink).toHaveAttribute('href', /\/team\/member\/1/);
  await aliceLink.click();
  await expect(page).toHaveURL(/\/team\/member\/1/, { timeout: 15_000 });
  await expect(page.getByRole('link', { name: '返回成员列表' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('MEMBER Alice / OVERVIEW')).toBeVisible({ timeout: 15_000 });
});

test('renders empty-team, no-team, and forbidden states independently', async ({ page, request }) => {
  await page.goto('/team?teamId=3');
  await expect(page.locator('[data-state="empty-team"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '团队暂无成员' })).toBeVisible();

  await page.goto('/team?teamId=99');
  await expect(page.locator('[data-state="forbidden"]')).toBeVisible();

  await request.get('http://127.0.0.1:4101/__scenario?value=team-no-team');
  await page.goto('/team');
  await expect(page.locator('[data-state="no-team"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '尚未分配团队' })).toBeVisible();
});
