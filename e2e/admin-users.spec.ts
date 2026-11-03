import { test, expect } from "@playwright/test"

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@expensedesk.test"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminPassw0rd!2026"

test("Administrator reviews users and opens the add-user dialog", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(ADMIN_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin\/users/)
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()
  await expect(page.getByText("Anita Desai").first()).toBeVisible()
  await expect(page.getByText("Administrator").filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText("Active").filter({ visible: true }).first()).toBeVisible()

  await page.getByRole("button", { name: "Add user" }).click()
  await expect(page.getByRole("dialog", { name: "Add user" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Name" })).toBeFocused()
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: "Employee" })).toBeVisible()
  await expect(page.getByText("At least 12 characters")).toBeVisible()
})
