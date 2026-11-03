import { test, expect } from "@playwright/test"

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL ?? "finance@expensedesk.test"
const FINANCE_PASSWORD = process.env.E2E_FINANCE_PASSWORD ?? "FinancePassw0rd!2026"

test("Finance dashboard keeps its look", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(FINANCE_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(FINANCE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/finance/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("Loading…")).toBeHidden({ timeout: 15_000 })
  await expect(page).toHaveScreenshot("finance-dashboard.png", { animations: "disabled" })
})
