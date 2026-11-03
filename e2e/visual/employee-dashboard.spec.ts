import { test, expect } from "@playwright/test"

test("employee dashboard keeps its look", async ({ page }) => {
  await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: 7, name: "Asha Rao", email: "employee@expensedesk.test", roles: ["Employee"], manager_id: null, active: true } }) }))
  await page.route("**/api/reports", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [
    { id: 11, title: "New client visit", status: "submitted", total_paise: 75050, updated_at: "2026-11-02T04:00:00Z" },
    { id: 12, title: "Fix hotel receipt", status: "changes_requested", total_paise: 30000, updated_at: "2026-11-01T04:00:00Z" },
  ] }) }))
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Asha Rao" })).toBeVisible()
  await expect(page).toHaveScreenshot("employee-dashboard.png", { animations: "disabled" })
})
