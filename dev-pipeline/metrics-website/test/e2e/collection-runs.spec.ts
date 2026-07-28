import { expect, type Locator, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=collection-jobs');
});

async function waitForLinkHydration(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
        if (!propsKey) return false;
        const props = (element as unknown as Record<string, Record<string, unknown>>)[propsKey];
        return typeof props?.onClick === 'function';
      }),
    )
    .toBe(true);
}

test('submits dry-run and opens a running job with rejection details and cancellation', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '采集运行' })).toBeVisible();
  await expect(page.getByText('running', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Dry-run' }).click();
  await expect(page.getByRole('status')).toHaveText('Dry-run 已排队');

  const runLink = page.getByRole('link', { name: '查看 Run 3' });
  await expect(runLink).toHaveAttribute('href', '/admin/collection/3');
  await waitForLinkHydration(runLink);
  await runLink.click();
  await expect(page).toHaveURL(/\/admin\/collection\/3/);
  await expect(page.getByText('RUN / 3', { exact: true })).toBeVisible();
  await expect(page.getByText('unknown-key')).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByRole('status')).toHaveText('取消请求已记录');
});

test('retries a failed durable job from its detail page', async ({ page }) => {
  await page.goto('/admin/collection/2');
  await expect(page.getByText('git: Remote branch unavailable')).toBeVisible();
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.getByRole('status')).toHaveText('重试任务已排队');
  const backLink = page.getByRole('link', { name: '返回采集控制台' });
  await waitForLinkHydration(backLink);
  await backLink.click();
  await expect(page.getByText('queued', { exact: true })).toBeVisible();
});
