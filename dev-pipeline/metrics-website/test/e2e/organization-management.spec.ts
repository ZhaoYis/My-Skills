import { expect, type Locator, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=organization');
});

async function waitForHydration(locator: Locator) {
  await expect.poll(() => locator.evaluate((element) => {
    const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
    if (!propsKey) return false;
    const props = (element as unknown as Record<string, Record<string, unknown>>)[propsKey];
    return typeof props?.onClick === 'function';
  })).toBe(true);
}

test('previews uploaded organization JSON, confirms apply, and retries failed history', async ({ page }) => {
  await page.goto('/admin/organization');
  await expect(page.getByRole('heading', { name: '同步控制' })).toBeVisible();
  await expect(page.getByText('凭证未配置')).toHaveCount(3);
  await expect(page.locator('body')).not.toContainText('app-secret');

  await page.getByLabel('同步源').fill('playwright-upload');
  await page.getByLabel('上传 canonical JSON').setInputFiles({
    name: 'organization.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      teams: [
        { externalId: 'quality', name: 'Quality', slug: 'quality' },
        { externalId: 'automation', name: 'Automation', slug: 'automation', parentExternalId: 'quality' },
      ],
      developers: [
        { externalId: 'qa-alice', email: 'qa-alice@example.test', name: 'QA Alice', teamExternalId: 'automation' },
      ],
    })),
  });
  await page.getByRole('button', { name: '预览差异' }).click();
  await expect(page.getByRole('status')).toHaveText('差异预览已生成，确认后才会写入');
  const preview = page.locator('[data-state="sync-preview"]');
  await expect(preview).toContainText('新增团队2');
  await expect(preview).toContainText('新增成员1');
  await preview.getByRole('button', { name: '确认执行' }).click();
  await expect(page.getByRole('status')).toHaveText('组织同步已排队');

  await page.getByRole('button', { name: '查看同步 8' }).click();
  const detail = page.getByRole('dialog', { name: '同步详情' });
  await expect(detail).toContainText('Directory transaction timed out');
  await expect(detail).toContainText('database');
  await detail.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '重试同步 8' }).click();
  await expect(page.getByRole('status')).toHaveText('同步重试已排队');
});

test('administrator manages teams, claims, assignments, and safe deactivation', async ({ page }) => {
  await page.goto('/admin/organization');
  await expect(page.getByRole('heading', { name: '组织管理' })).toBeVisible();
  await expect(page.getByText('Engineering', { exact: true })).toBeVisible();
  await expect(page.locator('.claim-state.unlinked')).toBeVisible();

  await page.getByRole('button', { name: '新增团队' }).click();
  const createDialog = page.getByRole('dialog', { name: '新增团队' });
  await createDialog.getByLabel('名称').fill('Quality');
  await createDialog.getByLabel('Slug').fill('quality');
  await createDialog.getByLabel('父团队').selectOption('1');
  await createDialog.getByLabel('外部 ID').fill('team-quality');
  await createDialog.getByRole('button', { name: '保存团队' }).click();
  await expect(createDialog.getByRole('status')).toHaveText('团队配置已保存');
  await createDialog.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByText('Quality', { exact: true })).toBeVisible();

  const editQuality = page.getByRole('button', { name: '编辑团队 Quality' });
  await waitForHydration(editQuality);
  await editQuality.click();
  const editDialog = page.getByRole('dialog', { name: '编辑团队' });
  await editDialog.getByLabel('父团队').selectOption('3');
  await editDialog.getByRole('button', { name: '保存团队' }).click();
  await expect(editDialog.getByRole('status')).toHaveText('团队配置已保存');
  await editDialog.getByRole('button', { name: '关闭' }).click();

  const editEngineering = page.getByRole('button', { name: '编辑团队 Engineering' });
  await waitForHydration(editEngineering);
  await editEngineering.click();
  const cycleDialog = page.getByRole('dialog', { name: '编辑团队' });
  await cycleDialog.getByLabel('父团队').selectOption('2');
  await cycleDialog.getByRole('button', { name: '保存团队' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '团队不能移动到自身或其子团队' }).first(),
  ).toBeVisible();
  if (await cycleDialog.isVisible()) {
    await cycleDialog.getByRole('button', { name: '关闭' }).click();
  }

  await page.getByLabel('搜索开发者').fill('pending@example.test');
  await page.getByLabel('认领状态').selectOption('unlinked');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect(page.getByText('pending@example.test')).toBeVisible();
  const editDeveloper = page.getByRole('button', { name: '编辑开发者 pending@example.test' });
  await waitForHydration(editDeveloper);
  await editDeveloper.click();
  const developerDialog = page.getByRole('dialog', { name: '编辑开发者' });
  await developerDialog.getByLabel('团队').selectOption('4');
  await developerDialog.getByLabel('角色').selectOption('admin');
  await developerDialog.getByLabel('OIDC externalId').fill('oidc-pending');
  await developerDialog.getByRole('button', { name: '保存开发者' }).click();
  await expect(developerDialog.getByRole('status')).toHaveText('开发者权限与归属已更新');
  await developerDialog.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByText('pending@example.test')).toHaveCount(0);

  await page.goto('/admin/organization');
  const deactivatePlatform = page.getByRole('button', { name: '停用团队 Platform' });
  await waitForHydration(deactivatePlatform);
  await deactivatePlatform.click();
  const deactivateDialog = page.getByRole('dialog', { name: '停用 Platform' });
  await deactivateDialog.getByRole('button', { name: '确认停用' }).click();
  await expect(deactivateDialog.getByRole('status')).toContainText('团队仍有活跃成员');
  await deactivateDialog.getByLabel('成员处理').selectOption('unassign');
  await deactivateDialog.getByRole('button', { name: '确认停用' }).click();
  await expect(deactivateDialog.getByRole('status')).toHaveText('团队已停用，历史归属保留');
  await deactivateDialog.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('button', { name: '停用团队 Platform' })).toHaveCount(0);
});

test('member cannot render or call organization management', async ({ page, request }) => {
  await request.get('http://127.0.0.1:4101/__scenario?value=forbidden');
  const apiResponse = await request.get('http://127.0.0.1:4101/api/v1/teams');
  expect(apiResponse.status()).toBe(403);
  await page.goto('/admin/organization');
  await expect(page.locator('[data-state="forbidden"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '无权访问' })).toBeVisible();
});
