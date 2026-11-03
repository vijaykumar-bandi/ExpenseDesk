import { test, expect } from '@playwright/test';

const report = {
  id: 2,
  title: 'Paid client visit',
  business_purpose: 'Customer renewal meeting',
  status: 'paid',
  total_paise: 200075,
  employee: { id: 3, name: 'Arjun Mehta' },
  manager: { id: 4, name: 'Priya Sharma' },
  lines: [{
    id: 1,
    expense_date: '2026-10-20',
    category: { id: 1, name: 'Travel' },
    merchant: 'IndiGo',
    amount_paise: 200075,
    note: 'Return flight',
    receipt: { id: 31, file_name: 'flight.pdf', mime_type: 'application/pdf', size: 1024 },
  }],
  reimbursement: { amount_paise: 200075, payment_date: '2026-10-25', payment_reference: 'NEFT-7788' },
  audit: [{
    id: 3,
    action: 'paid',
    actor: { id: 6, name: 'Vikram Rao' },
    created_at: '2026-10-25T06:00:00Z',
    from_status: 'approved',
    to_status: 'paid',
    reason: null,
    previous_manager: null,
    new_manager: null,
    amount_paise: 200075,
    payment_date: '2026-10-25',
    payment_reference: 'NEFT-7788',
  }],
};

test('paid report keeps receipts and history without changing controls', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ json: { user: { id: 1, name: 'Anita Desai', email: 'admin@expensedesk.test', roles: ['Administrator'], manager_id: null, active: true } } }));
  await page.route('**/api/reports/2', (route) => route.fulfill({ json: { data: report } }));
  await page.goto('/reports/2');

  await expect(page.getByRole('heading', { name: 'Paid client visit' })).toBeVisible();
  await expect(page.getByText('Customer renewal meeting')).toBeVisible();
  await expect(page.getByText('₹2,000.75').first()).toBeVisible();
  await expect(page.getByText('Arjun Mehta')).toBeVisible();
  await expect(page.getByText('Priya Sharma')).toBeVisible();
  await expect(page.getByText('IndiGo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open receipt flight.pdf' })).toHaveAttribute('href', '/api/receipts/31');
  await expect(page.getByText('Vikram Rao')).toBeVisible();
  await expect(page.getByText('25 Oct 2026, 11:30')).toBeVisible();
  await expect(page.getByText(/NEFT-7788/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Approve|Request changes|Reject|Reassign/ })).toHaveCount(0);
});

test('inaccessible report shows only the access message', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ json: { user: { id: 7, name: 'Other Employee', email: 'other@expensedesk.test', roles: ['Employee'], manager_id: 4, active: true } } }));
  await page.route('**/api/reports/99', (route) => route.fulfill({ status: 403, json: { message: 'You do not have access to this report' } }));
  await page.goto('/reports/99');
  await expect(page.getByText('You do not have access to this report')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Expense lines' })).toHaveCount(0);
});
