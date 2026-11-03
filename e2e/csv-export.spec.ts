import { test, expect } from "@playwright/test"

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL ?? "finance@expensedesk.test"
const FINANCE_PASSWORD = process.env.E2E_FINANCE_PASSWORD ?? "FinancePassw0rd!2026"

test("Finance exports CSV with the active filters", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(FINANCE_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(FINANCE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/finance/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible({ timeout: 15_000 })
  await page.getByRole("textbox", { name: "From" }).fill("2026-10-01")
  await page.getByRole("textbox", { name: "To" }).fill("2026-10-31")
  await page.getByRole("searchbox", { name: "Search" }).fill("missing")

  const exportLink = page.getByRole("link", { name: "Export CSV" })
  await expect(exportLink).toHaveAttribute(
    "href",
    "/api/finance/export.csv?from=2026-10-01&to=2026-10-31&q=missing",
  )
  const downloadPromise = page.waitForEvent("download")
  await exportLink.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe("expensedesk-payments.csv")
})
