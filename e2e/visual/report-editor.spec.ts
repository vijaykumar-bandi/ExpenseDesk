import { test, expect } from "@playwright/test"

const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "employee@expensedesk.test"
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? "EmployeePassw0rd!2026"

test("Report editor keeps its look", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(EMPLOYEE_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(EMPLOYEE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
  await page.goto("/reports/new")
  await expect(page.getByRole("heading", { name: "New report" })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("Loading…")).toBeHidden({ timeout: 15_000 })
  await expect(page).toHaveScreenshot("report-editor.png", { animations: "disabled" })
})
