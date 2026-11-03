import { test, expect } from "@playwright/test"

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@expensedesk.test"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminPassw0rd!2026"

test("Administration users keeps its look", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(ADMIN_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin\/users/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("Loading…")).toBeHidden({ timeout: 15_000 })
  await expect(page.getByText("Vikram Rao").filter({ visible: true }).first()).toBeVisible()
  await expect(page).toHaveScreenshot("admin-users.png", { animations: "disabled" })
})
