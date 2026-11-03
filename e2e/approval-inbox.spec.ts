import { expect, test, type Page } from '@playwright/test';

const manager = {
  id: 4,
  name: 'Meera Manager',
  email: 'manager@expensedesk.test',
  roles: ['Manager'],
  manager_id: null,
  active: true,
};

const reports = [
  {
    id: 31,
    title: 'Client visit in Pune',
    status: 'submitted',
    total_paise: 200075,
    submitted_at: '2026-10-01T04:30:00Z',
    employee: { id: 2, name: 'Asha Rao' },
    manager: { id: 4, name: 'Meera Manager' },
    waiting_days: 5,
  },
  {
    id: 32,
    title: 'Team lunch',
    status: 'submitted',
    total_paise: 45000,
    submitted_at: '2026-10-20T04:30:00Z',
    employee: { id: 3, name: 'Bilal Khan' },
    manager: { id: 4, name: 'Meera Manager' },
    waiting_days: 1,
  },
];

async function mockManager(page: Page): Promise<void> {
  await page.route('**/api/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: manager }),
  }));
  await page.route('**/api/reports?scope=inbox', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: reports }),
  }));
}

test('manager filters and uses the approval inbox', async ({ page }) => {
  await mockManager(page);
  await page.goto('/approvals');

  await expect(page.getByRole('heading', { name: 'Approval inbox' })).toBeVisible();
  const visibleReports = page.locator('.inbox-table:visible, .inbox-cards:visible');
  await expect(visibleReports).toContainText('Asha Rao');
  await expect(visibleReports).toContainText('₹2,000.75');
  await expect(visibleReports).toContainText('Waiting 3+ days');

  await page.getByLabel('Employee').selectOption('3');
  await expect(visibleReports).toContainText('Bilal Khan');
  await expect(visibleReports).not.toContainText('Asha Rao');

  await page.getByLabel('Minimum amount in INR').fill('100000');
  const visibleEmptyState = page.locator('.inbox-table:visible, .phone-empty:visible');
  await expect(visibleEmptyState.getByText('No reports match these filters', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  const reportLink = page.locator('a[href="/reports/31"]:visible');
  await expect(reportLink).toBeVisible();
  await expect(reportLink).toHaveAttribute('href', '/reports/31');
});
