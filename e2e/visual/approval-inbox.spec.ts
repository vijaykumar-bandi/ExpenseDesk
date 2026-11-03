import { expect, test } from '@playwright/test';

test('approval inbox visual baseline', async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 4, name: 'Priya Sharma', email: 'manager@expensedesk.test', roles: ['Manager'], active: true } }) }));
  await page.route('**/api/reports?scope=inbox', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 2, title: 'Team offsite', status: 'submitted', total_paise: 170025, submitted_at: '2026-10-30T19:34:00Z', employee: { id: 2, name: 'Arjun Mehta' }, waiting_days: 4 }] }) }));
  await page.goto('/approvals');
  await expect(page.getByRole('heading', { name: 'Approval inbox' })).toBeVisible();
  await expect(page).toHaveScreenshot('approval-inbox.png', { animations: 'disabled' });
});
