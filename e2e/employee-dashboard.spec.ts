import { test, expect } from "@playwright/test"

const user = { id: 7, name: "Asha Rao", email: "employee@expensedesk.test", roles: ["Employee"], manager_id: null, active: true }
const reports = [
  { id: 11, title: "New client visit", status: "submitted", total_paise: 75050, updated_at: "2026-11-02T04:00:00Z" },
  { id: 12, title: "Fix hotel receipt", status: "changes_requested", total_paise: 30000, updated_at: "2026-11-01T04:00:00Z" },
  { id: 10, title: "Office supplies", status: "draft", total_paise: 10000, updated_at: "2026-10-01T04:00:00Z" },
]

async function signedIn(page: import("@playwright/test").Page) {
  await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user }) }))
}

test("employee dashboard groups and lists reports and links to the right screens", async ({ page }) => {
  await signedIn(page)
  await page.route("**/api/reports", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: reports }) }))
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Asha Rao" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Reports by status" })).toContainText("Draft1₹100.00Awaiting approval1₹750.50Changes requested1₹300.00Approved0₹0.00Paid0₹0.00")
  await expect(page.getByRole("list", { name: "Your reports" }).getByRole("link")).toHaveCount(3)
  await expect(page.getByRole("link", { name: /New client visit/ })).toHaveAttribute("href", "/reports/11")
  await expect(page.getByRole("link", { name: /Fix hotel receipt/ })).toHaveAttribute("href", "/reports/12/edit")
  await expect(page.getByRole("link", { name: "New report" })).toHaveAttribute("href", "/reports/new")
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth))
  expect(await page.getByRole("link", { name: "New report" }).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
})

test("employee dashboard shows empty and retryable error states", async ({ page }) => {
  await signedIn(page)
  let calls = 0
  await page.route("**/api/reports", async route => {
    calls++
    await route.fulfill(calls === 1
      ? { status: 500, contentType: "application/json", body: JSON.stringify({ message: "Failure" }) }
      : { status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) })
  })
  await page.goto("/dashboard")
  await expect(page.getByText("Reports could not be loaded")).toBeVisible()
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("You have no expense reports yet")).toBeVisible()
  await expect(page.getByRole("link", { name: "New report" })).toHaveCount(2)
})
