import { test, expect } from '@playwright/test';

test('admin audit visual baseline', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ json: { user: { id: 1, name: 'Anita Desai', email: 'admin@expensedesk.test', roles: ['Administrator'], manager_id: null, active: true } } }));
  await page.route('**/api/admin/audit?page=1', (route) => route.fulfill({ json: { data: [{ id: 3, report_id: 2, action: 'approved', actor: { id: 4, name: 'Priya Sharma' }, created_at: '2026-11-03T04:46:50Z', from_status: 'submitted', to_status: 'approved', reason: 'Approved after review', previous_manager: null, new_manager: null, amount_paise: null, payment_date: null, payment_reference: null }], meta: { current_page: 1, last_page: 1, total: 1 } } }));
  await page.goto('/admin/audit');
  await expect(page.getByText('submitted → approved')).toBeVisible();
  await expect(page).toHaveScreenshot('admin-audit.png', { animations: 'disabled' });
});
