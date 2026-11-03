import { test, expect } from '@playwright/test';

test('administrator sees newest-first paged audit history without edit controls', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ json: { user: { id: 1, name: 'Anita Desai', email: 'admin@expensedesk.test', roles: ['Administrator'], manager_id: null, active: true } } }));
  await page.route('**/api/admin/audit?page=1', (route) => route.fulfill({ json: {
    data: [
      { id: 3, report_id: 2, action: 'approved', actor: { id: 4, name: 'Priya Sharma' }, created_at: '2026-11-03T04:46:50Z', from_status: 'submitted', to_status: 'approved', reason: 'Approved after review', previous_manager: null, new_manager: null, amount_paise: null, payment_date: null, payment_reference: null },
      { id: 2, report_id: 2, action: 'reassigned', actor: { id: 1, name: 'Anita Desai' }, created_at: '2026-11-02T04:46:50Z', from_status: null, to_status: null, reason: 'Coverage change', previous_manager: { id: 4, name: 'Priya Sharma' }, new_manager: { id: 5, name: 'Rahul Verma' }, amount_paise: null, payment_date: null, payment_reference: null },
    ],
    meta: { current_page: 1, last_page: 2, total: 51 },
  } }));
  await page.goto('/admin/audit');

  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('03 Nov 2026, 10:16');
  await expect(rows.nth(0)).toContainText('Priya Sharma');
  await expect(rows.nth(0)).toContainText('submitted → approved');
  await expect(rows.nth(1)).toContainText('Manager: Priya Sharma → Rahul Verma');
  await expect(page.getByText('Page 1 of 2 · 51 events')).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit|Delete/ })).toHaveCount(0);
});

test('non-administrator sees the administration access message', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ json: { user: { id: 3, name: 'Arjun Mehta', email: 'employee@expensedesk.test', roles: ['Employee'], manager_id: 4, active: true } } }));
  await page.goto('/admin/audit');
  await expect(page.getByText('You do not have access to this page')).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
});
