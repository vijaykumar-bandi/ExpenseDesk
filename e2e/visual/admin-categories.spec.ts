import { test, expect } from "@playwright/test"

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@expensedesk.test"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminPassw0rd!2026"

test("Administration categories keeps its look", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(ADMIN_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin\/users/, { timeout: 15_000 })

  await page.route("**/api/admin/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: 1, name: "Accommodation", active: true },
          { id: 2, name: "Meals", active: true },
          { id: 3, name: "Office Supplies", active: true },
          { id: 4, name: "Other", active: true },
          { id: 5, name: "Travel", active: true },
        ],
      }),
    })
  })

  await page.goto("/admin/categories")
  await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("5 active of 5 categories")).toBeVisible()
  await expect(page.getByRole("button", { name: "Deactivate Travel" })).toBeVisible()
  await expect(page).toHaveScreenshot("admin-categories.png", { animations: "disabled" })
})
