import { expect, type Page, test } from '@playwright/test';

async function expectNoViewportOrSiblingOverlap(page: Page) {
  const result = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'main h1, main h2, main h3, main button, main input, main select, main textarea, main [role="alert"], main [role="status"]',
      ),
    ).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    });
    const overlaps: string[] = [];
    for (let left = 0; left < candidates.length; left += 1) {
      for (let right = left + 1; right < candidates.length; right += 1) {
        const first = candidates[left];
        const second = candidates[right];
        if (!first || !second || first.parentElement !== second.parentElement) continue;
        if ([first, second].some((element) => ['absolute', 'fixed'].includes(getComputedStyle(element).position))) continue;
        const a = first.getBoundingClientRect();
        const b = second.getBoundingClientRect();
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width > 1 && height > 1) overlaps.push(`${first.tagName}:${second.tagName}`);
      }
    }
    return { overflow, overlaps };
  });
  expect(result.overflow, 'page must not overflow the viewport horizontally').toBeLessThanOrEqual(1);
  expect(result.overlaps, 'sibling controls and status content must not overlap').toEqual([]);
}

for (const pageCase of [
  { name: 'personal', path: '/', heading: '暂无可信数据', scenario: 'empty' },
  { name: 'team', path: '/team', heading: '开发能效脉搏', scenario: 'team' },
  { name: 'administration', path: '/admin', heading: '采集控制台', scenario: 'repos' },
  {
    name: 'sign-in',
    path: '/signin?error=CallbackRouteError',
    heading: '进入能效控制台',
    scenario: 'empty',
  },
] as const) {
  test(`${pageCase.name} page has a stable responsive layout`, async ({ page, request }) => {
    await request.get(`http://127.0.0.1:4101/__scenario?value=${pageCase.scenario}`);
    await page.goto(pageCase.path);
    await expect(page.getByRole('heading', { name: pageCase.heading })).toBeVisible();
    await expectNoViewportOrSiblingOverlap(page);
  });
}

test('error state has a stable responsive layout', async ({ page, request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=server');
  await page.goto('/');
  await expect(page.locator('[data-state="unavailable"]')).toBeVisible();
  await expectNoViewportOrSiblingOverlap(page);
});
