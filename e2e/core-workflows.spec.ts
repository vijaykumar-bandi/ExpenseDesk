import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const accounts = {
  employee: {
    email: process.env.E2E_EMPLOYEE_EMAIL ?? 'employee@expensedesk.test',
    password: process.env.E2E_EMPLOYEE_PASSWORD ?? 'EmployeePassw0rd!2026',
    home: /\/dashboard/,
  },
  otherEmployee: {
    email: process.env.E2E_OTHER_EMPLOYEE_EMAIL ?? 'employee2@expensedesk.test',
    password: process.env.E2E_OTHER_EMPLOYEE_PASSWORD ?? 'EmployeePassw0rd!2026',
    home: /\/dashboard/,
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? 'manager@expensedesk.test',
    password: process.env.E2E_MANAGER_PASSWORD ?? 'ManagerPassw0rd!2026',
    home: /\/approvals/,
  },
  finance: {
    email: process.env.E2E_FINANCE_EMAIL ?? 'finance@expensedesk.test',
    password: process.env.E2E_FINANCE_PASSWORD ?? 'FinancePassw0rd!2026',
    home: /\/finance/,
  },
};

type Account = (typeof accounts)[keyof typeof accounts];

let reportId = '';
let receiptUrl = '';
let csvNonmatchReportId = '';
let csvOutOfPeriodReportId = '';
const reportTitle = `Playwright travel ${Date.now()}`;
const csvNonmatchTitle = `Playwright CSV nonmatch ${Date.now()}`;
const csvOutOfPeriodTitle = `Playwright CSV prior period ${Date.now()}`;
const changeReason = 'Please clarify the accommodation business purpose.';
const paymentReference = `PW-MATCH-${Date.now()}`;
const nonmatchingPaymentReference = `PW-OTHER-${Date.now()}`;
const outOfPeriodPaymentReference = `${paymentReference}-OLD`;

async function signedInPage(browser: Browser, account: Account): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(account.home, { timeout: 15_000 });
  return { context, page };
}

function todayInKolkata(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function previousMonthInKolkata(): string {
  const [year, month] = todayInKolkata().split('-').map(Number);
  const previousMonth = new Date(Date.UTC(year, month - 2, 15));
  return previousMonth.toISOString().slice(0, 10);
}

function paiseFromInr(text: string): number {
  const amount = text.match(/₹([\d,]+\.\d{2})/)?.[1];
  if (!amount) throw new Error(`No INR amount found in: ${text}`);
  return Math.round(Number(amount.replaceAll(',', '')) * 100);
}

async function createAndSubmitSimpleReport(page: Page, title: string): Promise<string> {
  await page.goto('/reports/new');
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('textbox', { name: 'Business purpose' }).fill('CSV filter coverage fixture');
  await page.getByRole('button', { name: 'Add line' }).click();
  const line = page.getByRole('article', { name: 'Line 1' });
  await line.getByRole('textbox', { name: 'Expense date' }).fill(todayInKolkata());
  await line.getByLabel('Category').selectOption({ label: 'Travel' });
  await line.getByRole('textbox', { name: 'Merchant' }).fill('CSV Fixture Merchant');
  await line.getByRole('textbox', { name: 'Amount (INR)' }).fill('1.00');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page).toHaveURL(/\/reports\/\d+$/, { timeout: 15_000 });
  return new URL(page.url()).pathname.split('/').pop() ?? '';
}

async function approveInboxReport(page: Page, id: string): Promise<void> {
  await page.goto('/approvals');
  const reportLink = page.locator(`a[href="/reports/${id}"]:visible`);
  await expect(reportLink).toBeVisible({ timeout: 15_000 });
  await reportLink.click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog', { name: 'Approve this report?' }).getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Approved').first()).toBeVisible();
}

async function recordPayment(page: Page, title: string, date: string, reference: string): Promise<void> {
  await page.goto(`/finance?from=${date}&to=${date}`);
  const reportRow = page.getByRole('row').filter({ hasText: title });
  await expect(reportRow).toBeVisible({ timeout: 15_000 });
  await reportRow.getByRole('button', { name: 'Record payment' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record payment' });
  await dialog.getByRole('textbox', { name: 'Payment date' }).fill(date);
  await dialog.getByRole('textbox', { name: 'Payment reference' }).fill(reference);
  await dialog.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(page.getByRole('row').filter({ hasText: reference })).toBeVisible({ timeout: 15_000 });
}

async function openInboxReport(page: Page): Promise<void> {
  const reportLink = page.locator(`a[href="/reports/${reportId}"]:visible`);
  await expect(reportLink).toBeVisible({ timeout: 15_000 });
  await reportLink.click();
  await expect(page).toHaveURL(new RegExp(`/reports/${reportId}$`));
}

test.describe.serial('Employee, Manager, Finance and access-control workflows', () => {
  test('Employee signs in, creates and submits a ₹2,000.75 report with a receipt', async ({ browser }) => {
    const { context, page } = await signedInPage(browser, accounts.employee);
    try {
      await page.getByRole('link', { name: 'New report' }).click();
      await page.getByRole('textbox', { name: 'Title' }).fill(reportTitle);
      await page.getByRole('textbox', { name: 'Business purpose' }).fill('Customer travel and accommodation');

      await page.getByRole('button', { name: 'Add line' }).click();
      const travel = page.getByRole('article', { name: 'Line 1' });
      await travel.getByRole('textbox', { name: 'Expense date' }).fill(todayInKolkata());
      await travel.getByLabel('Category').selectOption({ label: 'Travel' });
      await travel.getByRole('textbox', { name: 'Merchant' }).fill('Airport Metro');
      await travel.getByRole('textbox', { name: 'Amount (INR)' }).fill('750.50');

      await page.getByRole('button', { name: 'Add line' }).click();
      const accommodation = page.getByRole('article', { name: 'Line 2' });
      await accommodation.getByRole('textbox', { name: 'Expense date' }).fill(todayInKolkata());
      await accommodation.getByLabel('Category').selectOption({ label: 'Accommodation' });
      await accommodation.getByRole('textbox', { name: 'Merchant' }).fill('ExpenseDesk Hotel');
      await accommodation.getByRole('textbox', { name: 'Amount (INR)' }).fill('1250.25');
      await accommodation.getByLabel('Add receipt to Line 2').setInputFiles({
        name: 'accommodation-receipt.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n% Playwright receipt\n'),
      });

      await expect(accommodation.getByText('accommodation-receipt.pdf')).toBeVisible();
      await expect(page.getByText('₹2,000.75')).toBeVisible();
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(page).toHaveURL(/\/reports\/\d+$/, { timeout: 15_000 });
      reportId = new URL(page.url()).pathname.split('/').pop() ?? '';
      expect(reportId).not.toBe('');
      await expect(page.getByText('Awaiting approval')).toBeVisible();
      await expect(page.getByText('₹2,000.75').first()).toBeVisible();
      await expect(page.getByText('Submitted')).toBeVisible();
      receiptUrl = await page.getByRole('link', { name: 'Open receipt accommodation-receipt.pdf' }).getAttribute('href') ?? '';
      expect(receiptUrl).toMatch(/^\/api\/receipts\/\d+$/);

      csvNonmatchReportId = await createAndSubmitSimpleReport(page, csvNonmatchTitle);
      csvOutOfPeriodReportId = await createAndSubmitSimpleReport(page, csvOutOfPeriodTitle);
      expect(csvNonmatchReportId).not.toBe('');
      expect(csvOutOfPeriodReportId).not.toBe('');
    } finally {
      await context.close();
    }
  });

  test('Manager requests changes, Employee resubmits, then Manager approves', async ({ browser }) => {
    const managerSession = await signedInPage(browser, accounts.manager);
    try {
      await openInboxReport(managerSession.page);
      await managerSession.page.getByRole('button', { name: 'Request changes' }).click();
      const changesDialog = managerSession.page.getByRole('dialog', { name: 'Request changes' });
      await changesDialog.getByRole('textbox', { name: 'Reason' }).fill('Too short');
      await changesDialog.getByRole('button', { name: 'Request changes' }).click();
      await expect(managerSession.page.getByText('Reason must be at least 10 characters')).toBeVisible();
      await changesDialog.getByRole('textbox', { name: 'Reason' }).fill(changeReason);
      await changesDialog.getByRole('button', { name: 'Request changes' }).click();
      await expect(managerSession.page.getByText('Changes requested').first()).toBeVisible();
      await expect(managerSession.page.getByText(changeReason)).toBeVisible();
      await managerSession.page.goto('/approvals');
      await expect(managerSession.page.locator(`a[href="/reports/${reportId}"]`)).toHaveCount(0);
    } finally {
      await managerSession.context.close();
    }

    const employeeSession = await signedInPage(browser, accounts.employee);
    try {
      await employeeSession.page.goto(`/reports/${reportId}/edit`);
      await expect(employeeSession.page.getByRole('heading', { name: 'Edit report' })).toBeVisible();
      await employeeSession.page.getByRole('textbox', { name: 'Business purpose' }).fill(
        'Customer travel and accommodation for the annual account review',
      );
      await employeeSession.page.getByRole('button', { name: 'Submit' }).click();
      await expect(employeeSession.page).toHaveURL(new RegExp(`/reports/${reportId}$`));
      const history = employeeSession.page.getByRole('heading', { name: 'Activity history' }).locator('..');
      await expect(history.getByText(changeReason)).toBeVisible();
      await expect(history.getByText('Submitted')).toHaveCount(2);
    } finally {
      await employeeSession.context.close();
    }

    const approvalSession = await signedInPage(browser, accounts.manager);
    try {
      await openInboxReport(approvalSession.page);
      await approvalSession.page.getByRole('button', { name: 'Approve' }).click();
      const approveDialog = approvalSession.page.getByRole('dialog', { name: 'Approve this report?' });
      await approveDialog.getByRole('button', { name: 'Approve' }).click();
      await expect(approvalSession.page.getByText('Approved').first()).toBeVisible();
      await expect(approvalSession.page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
      const approvalHistory = approvalSession.page.getByRole('heading', { name: 'Activity history' }).locator('..');
      const approvalEntry = approvalHistory.locator('.entry').filter({ hasText: 'Approved' });
      await expect(approvalEntry).toHaveCount(1);
      await expect(approvalEntry).toContainText('Priya Sharma');
      await approvalSession.page.goto('/approvals');
      await expect(approvalSession.page.locator(`a[href="/reports/${reportId}"]`)).toHaveCount(0);

      await approveInboxReport(approvalSession.page, csvNonmatchReportId);
      await approveInboxReport(approvalSession.page, csvOutOfPeriodReportId);
    } finally {
      await approvalSession.context.close();
    }
  });

  test('Finance records the full payment, updates totals and exports matching CSV', async ({ browser }) => {
    const { context, page } = await signedInPage(browser, accounts.finance);
    try {
      const outstandingBefore = paiseFromInr(await page.getByTestId('outstanding-total').innerText());
      const paidBefore = paiseFromInr(await page.getByTestId('paid-total').innerText());
      const reportRow = page.getByRole('row').filter({ hasText: reportTitle });
      await expect(reportRow).toContainText('₹2,000.75');
      await reportRow.getByRole('button', { name: 'Record payment' }).click();
      const dialog = page.getByRole('dialog', { name: 'Record payment' });
      await expect(dialog.getByRole('textbox', { name: 'Amount' })).toHaveValue('₹2,000.75');
      await dialog.getByRole('textbox', { name: 'Payment date' }).fill(todayInKolkata());
      await dialog.getByRole('textbox', { name: 'Payment reference' }).fill(paymentReference);
      await dialog.getByRole('button', { name: 'Confirm payment' }).click();

      await expect(page.getByRole('row').filter({ hasText: reportTitle })).toHaveCount(1);
      await expect(page.getByRole('row').filter({ hasText: reportTitle })).toContainText(paymentReference);
      await expect.poll(async () => paiseFromInr(await page.getByTestId('paid-total').innerText())).toBe(paidBefore + 200075);
      await expect.poll(async () => paiseFromInr(await page.getByTestId('outstanding-total').innerText())).toBe(
        outstandingBefore - 200075,
      );

      await page.goto(`/reports/${reportId}`);
      await expect(page.getByText('Paid').first()).toBeVisible();
      const paymentHistory = page.getByRole('heading', { name: 'Activity history' }).locator('..');
      const paymentEntry = paymentHistory.locator('.entry').filter({ hasText: 'Paid' });
      await expect(paymentEntry).toHaveCount(1);
      await expect(paymentEntry).toContainText('Vikram Rao');
      await expect(paymentEntry).toContainText('₹2,000.75');
      await expect(paymentEntry).toContainText(paymentReference);
      await expect(paymentEntry).toContainText(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(new Date(`${todayInKolkata()}T00:00:00+05:30`)),
      );

      await recordPayment(page, csvNonmatchTitle, todayInKolkata(), nonmatchingPaymentReference);
      await recordPayment(page, csvOutOfPeriodTitle, previousMonthInKolkata(), outOfPeriodPaymentReference);

      await page.goto('/finance');
      await page.getByRole('searchbox', { name: 'Search' }).fill(paymentReference);
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('link', { name: 'Export CSV' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('expensedesk-payments.csv');
      const csv = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of csv) chunks.push(Buffer.from(chunk));
      const contents = Buffer.concat(chunks).toString('utf8');
      expect(contents).toContain('Payment date,Payment reference,Employee,Report title,Amount in INR');
      expect(contents).toContain(paymentReference);
      expect(contents).toContain(reportTitle);
      expect(contents).toContain('2000.75');
      expect(contents).not.toContain(nonmatchingPaymentReference);
      expect(contents).not.toContain(csvNonmatchTitle);
      expect(contents).not.toContain(outOfPeriodPaymentReference);
      expect(contents).not.toContain(csvOutOfPeriodTitle);
    } finally {
      await context.close();
    }
  });

  test("another Employee cannot open the report or its receipt URL", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, accounts.otherEmployee);
    try {
      const reportResponse = page.waitForResponse((response) => response.url().endsWith(`/api/reports/${reportId}`));
      await page.goto(`/reports/${reportId}`);
      expect((await reportResponse).status()).toBe(403);
      await expect(page.getByText('You do not have access to this report')).toBeVisible();
      await expect(page.getByRole('heading', { name: reportTitle })).toHaveCount(0);

      const receiptResponse = await context.request.get(receiptUrl);
      expect(receiptResponse.status()).toBe(403);
      expect(await receiptResponse.json()).toEqual({ message: 'You do not have access to this report' });
    } finally {
      await context.close();
    }
  });
});
