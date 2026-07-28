import { expect, type Locator, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=repos');
});

async function waitForHydration(locator: Locator) {
  await expect.poll(() => locator.evaluate((element) => {
    const hasReactHandler = (node: Element | null, handler: string) => {
      if (!node) return false;
      const propsKey = Object.keys(node).find((key) => key.startsWith('__reactProps$'));
      if (!propsKey) return false;
      const props = (node as unknown as Record<string, Record<string, unknown>>)[propsKey];
      return typeof props?.[handler] === 'function';
    };
    return hasReactHandler(element, 'onClick') || hasReactHandler(element.closest('form'), 'onSubmit');
  })).toBe(true);
}

test('administrator completes the repository lifecycle', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'platform-api' })).toBeVisible();

  await page.getByRole('button', { name: '新增仓库' }).click();
  const dialog = page.getByRole('dialog', { name: '新增仓库' });
  await dialog.getByLabel('名称').fill('metrics-worker');
  await dialog.getByLabel('Git URL').fill('https://git.example.test/metrics-worker.git');
  await dialog.getByLabel('分支').fill('main');
  await dialog.getByLabel('保留天数').fill('180');
  await dialog.getByRole('button', { name: '测试连接' }).click();
  await expect(dialog.getByRole('status')).toHaveText('仓库与分支连接成功');
  await dialog.getByRole('button', { name: '保存' }).click();
  await expect(dialog.getByRole('status')).toHaveText('仓库配置已保存');
  await dialog.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('link', { name: 'metrics-worker' })).toBeVisible();

  await page.getByLabel('搜索仓库').fill('metrics-worker');
  await page.getByLabel('仓库状态').selectOption('active');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect(page.getByRole('link', { name: 'metrics-worker' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'platform-api' })).toHaveCount(0);

  const editButton = page.getByRole('button', { name: '编辑 metrics-worker' });
  await waitForHydration(editButton);
  await editButton.click();
  const editDialog = page.getByRole('dialog', { name: '编辑仓库' });
  await editDialog.getByLabel('名称').fill('metrics-worker-renamed');
  await editDialog.getByRole('button', { name: '保存' }).click();
  await expect(editDialog.getByRole('status')).toHaveText('仓库配置已保存');
  await editDialog.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('link', { name: 'metrics-worker-renamed' })).toBeVisible();

  await page.getByRole('button', { name: '采集 metrics-worker-renamed' }).click();
  await expect(page.getByRole('status')).toHaveText('单仓库采集已提交');
  const detailLink = page.getByRole('link', { name: 'metrics-worker-renamed' });
  await waitForHydration(detailLink);
  await detailLink.click();
  await expect(page.getByRole('heading', { name: 'metrics-worker-renamed' })).toBeVisible();
  await expect(page.getByText('最近采集日志')).toBeVisible();
  await expect(page.getByText('completed')).toBeVisible();

  const backLink = page.getByRole('link', { name: '返回仓库列表' });
  await waitForHydration(backLink);
  await backLink.click();
  const resetButton = page.getByRole('button', { name: '重置 metrics-worker-renamed' });
  await waitForHydration(resetButton);
  page.once('dialog', async (confirmation) => confirmation.accept());
  await resetButton.click();
  await expect(page.getByRole('status')).toHaveText('Checkpoint 已重置，历史指标保留');

  const toggleButton = page.getByRole('button', { name: '停用 metrics-worker-renamed' });
  await waitForHydration(toggleButton);
  await toggleButton.click();
  await expect(page.getByRole('status')).toHaveText('仓库已停用');
  await expect(page.getByText('inactive')).toBeVisible();

  const deleteButton = page.getByRole('button', { name: '删除 metrics-worker-renamed' });
  await waitForHydration(deleteButton);
  page.once('dialog', async (confirmation) => confirmation.accept());
  await deleteButton.click();
  await expect(page.getByRole('status')).toHaveText('仓库已软删除，历史指标保留');
  await expect(page.getByRole('link', { name: 'metrics-worker-renamed' })).toHaveCount(0);

  await page.getByLabel('仓库状态').selectOption('deleted');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect(page.getByRole('link', { name: 'metrics-worker-renamed' })).toBeVisible();
  await expect(page.getByText('deleted')).toBeVisible();
});

test('connection validation distinguishes authentication and branch failures', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: '新增仓库' }).click();
  const dialog = page.getByRole('dialog', { name: '新增仓库' });
  await dialog.getByLabel('名称').fill('invalid-repository');
  await dialog.getByLabel('Git URL').fill('https://auth.invalid/private.git');
  await dialog.getByRole('button', { name: '测试连接' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Git 仓库认证失败 (Request mock-repos)');

  await dialog.getByLabel('Git URL').fill('https://git.example.test/valid.git');
  await dialog.getByLabel('分支').fill('missing');
  await dialog.getByRole('button', { name: '测试连接' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Git 分支不存在: missing (Request mock-repos)');
  await dialog.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('link', { name: 'invalid-repository' })).toHaveCount(0);
});

test('member receives the forbidden management state and API response', async ({ page, request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=forbidden');
  const apiResponse = await request.get('http://127.0.0.1:4101/api/v1/repos');
  expect(apiResponse.status()).toBe(403);
  await page.goto('/admin');
  await expect(page.locator('[data-state="forbidden"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '无权访问' })).toBeVisible();
});
