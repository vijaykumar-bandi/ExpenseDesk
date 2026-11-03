import { test, expect } from "@playwright/test"

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL ?? "finance@expensedesk.test"
const FINANCE_PASSWORD = process.env.E2E_FINANCE_PASSWORD ?? "FinancePassw0rd!2026"

test("Finance reviews totals and validates a payment", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(FINANCE_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(FINANCE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/finance/)

  await page.route("**/api/finance/summary**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ outstanding_paise: 200075, outstanding_count: 1, paid_paise: 500000, paid_count: 1, from: "2026-11-01", to: "2026-11-30" }),
  }))
  await page.route("**/api/finance/outstanding", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: [{ id: 7, title: "Client visit", status: "approved", total_paise: 200075, submitted_at: "2026-10-18T05:00:00Z", decided_at: "2026-10-20T05:00:00Z", employee: { id: 2, name: "Priya Sharma" }, manager: { id: 3, name: "Ravi Kumar" }, waiting_days: 4 }] }),
  }))
  await page.route("**/api/finance/payments**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: [{ id: 11, report_id: 4, amount_paise: 500000, payment_date: "2026-11-02", payment_reference: "NEFT-778", employee: { id: 5, name: "Anil Rao" }, report_title: "Team offsite", recorded_by: { id: 9, name: "Finance One" }, created_at: "2026-11-02T06:00:00Z" }] }),
  }))
  await page.reload()

  await expect(page.getByTestId("outstanding-total")).toHaveText("₹2,000.75")
  await expect(page.getByTestId("paid-total")).toHaveText("₹5,000.00")
  await expect(page.getByRole("cell", { name: "Priya Sharma" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Client visit" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "NEFT-778" })).toBeVisible()

  await page.getByRole("button", { name: "Record payment" }).click()
  await expect(page.getByRole("dialog", { name: "Record payment" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue("₹2,000.75")
  await expect(page.getByRole("textbox", { name: "Amount" })).toHaveAttribute("readonly", "")
  await page.getByRole("textbox", { name: "Payment reference" }).fill("ab")
  await page.getByRole("button", { name: "Confirm payment" }).click()
  await expect(page.getByText("Payment reference must be at least 3 characters")).toBeVisible()
})
