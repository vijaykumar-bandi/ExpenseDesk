import { test, expect } from "@playwright/test"

const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "employee@expensedesk.test"
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? "EmployeePassw0rd!2026"

test("Employee builds a report and sees editor validation", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(EMPLOYEE_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(EMPLOYEE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
  await page.getByRole("link", { name: "New report" }).click()
  await expect(page.getByRole("heading", { name: "New report" })).toBeVisible()

  await expect(page.getByText("No expense lines yet. Add a line to start.")).toBeVisible()
  await expect(page.getByText("₹0.00")).toBeVisible()
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText("Add at least one expense line")).toBeVisible()

  await page.getByRole("button", { name: "Add line" }).click()
  const first = page.getByRole("article", { name: "Line 1" })
  await expect(first.getByLabel("Category").locator("option")).toHaveText([
    "Select a category", "Accommodation", "Meals", "Office Supplies", "Other", "Travel",
  ])
  await first.getByRole("textbox", { name: "Amount (INR)" }).fill("1000")
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText("Required").first()).toBeVisible()
  await expect(page.getByText("Receipt required")).toBeVisible()

  await first.getByRole("textbox", { name: "Expense date" }).fill("2099-01-01")
  await first.getByRole("textbox", { name: "Amount (INR)" }).fill("0")
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText("Expense date cannot be in the future")).toBeVisible()
  await expect(page.getByText("Amount must be more than zero")).toBeVisible()

  await page.getByRole("textbox", { name: "Title" }).fill("Wave 25 travel")
  await page.getByRole("textbox", { name: "Business purpose" }).fill("Client visit")
  await first.getByRole("textbox", { name: "Expense date" }).fill("2026-11-03")
  await first.getByLabel("Category").selectOption({ label: "Travel" })
  await first.getByRole("textbox", { name: "Merchant" }).fill("Metro")
  await first.getByRole("textbox", { name: "Amount (INR)" }).fill("750.50")
  await first.getByRole("textbox", { name: "Note (optional)" }).fill("Airport transfer")
  await page.getByRole("button", { name: "Add line" }).click()
  const second = page.getByRole("article", { name: "Line 2" })
  await second.getByRole("textbox", { name: "Expense date" }).fill("2026-11-03")
  await second.getByLabel("Category").selectOption({ label: "Meals" })
  await second.getByRole("textbox", { name: "Merchant" }).fill("Cafe")
  await second.getByRole("textbox", { name: "Amount (INR)" }).fill("1250.25")
  await expect(page.getByText("₹2,000.75")).toBeVisible()
  await expect(first.getByLabel("Add receipt to Line 1")).toHaveAttribute("capture", "environment")
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible()
})
