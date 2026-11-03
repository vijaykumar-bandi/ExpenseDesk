import { test, expect } from '@playwright/test';

test('report details visual baseline', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ json: { user: { id: 1, name: 'Anita Desai', email: 'admin@expensedesk.test', roles: ['Administrator'], manager_id: null, active: true } } }));
  await page.route('**/api/reports/2', (route) => route.fulfill({ json: { data: { id: 2, title: 'Paid client visit', business_purpose: 'Customer renewal meeting', status: 'paid', total_paise: 200075, employee: { id: 3, name: 'Arjun Mehta' }, manager: { id: 4, name: 'Priya Sharma' }, lines: [{ id: 1, expense_date: '2026-10-20', category: { id: 1, name: 'Travel' }, merchant: 'IndiGo', amount_paise: 200075, note: 'Return flight', receipt: { id: 31, file_name: 'flight.pdf', mime_type: 'application/pdf', size: 1024 } }], reimbursement: null, audit: [] } } }));
  await page.goto('/reports/2');
  await expect(page.getByRole('heading', { name: 'Paid client visit' })).toBeVisible();
  await expect(page).toHaveScreenshot('report-details.png', { animations: 'disabled' });
});
