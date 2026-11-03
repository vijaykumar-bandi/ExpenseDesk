import { test, expect, type Page } from "@playwright/test"

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@expensedesk.test"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminPassw0rd!2026"
const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "employee@expensedesk.test"
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? "EmployeePassw0rd!2026"

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByRole("textbox", { name: "Password" }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).not.toHaveURL(/\/sign-in/)
}

test("Administrator manages categories while existing reports keep theirs", async ({ browser }) => {
  const adminContext = await browser.newContext()
  const employeeContext = await browser.newContext()
  const admin = await adminContext.newPage()
  const employee = await employeeContext.newPage()

  await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD)
  await admin.goto("/admin/categories")
  await expect(admin.getByRole("heading", { name: "Categories" })).toBeVisible()
  await expect(admin.getByText("A deactivated category stays on the reports that already use it.")).toBeVisible()

  for (const name of ["Travel", "Meals", "Accommodation", "Office Supplies", "Other"]) {
    const row = admin.getByRole("listitem").filter({ hasText: name })
    await expect(row).toContainText("Active")
    await expect(row.getByRole("button", { name: `Deactivate ${name}` })).toBeVisible()
  }

  if (await admin.getByRole("listitem").filter({ hasText: "Training" }).count() === 0) {
    await admin.getByRole("button", { name: "Add category" }).click()
    await expect(admin.getByRole("textbox", { name: "Name" })).toBeFocused()
    await admin.getByRole("textbox", { name: "Name" }).fill("Training")
    await admin.getByRole("dialog").getByRole("button", { name: "Add category" }).click()
    await expect(admin.getByText('Category "Training" added.')).toBeVisible()
  }

  await signIn(employee, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
  await employee.goto("/reports/new")
  await expect(employee.getByRole("combobox", { name: "Category" }).getByRole("option", { name: "Training" })).toHaveCount(1)

  const travelRow = admin.getByRole("listitem").filter({ hasText: "Travel" })
  await travelRow.getByRole("button", { name: "Deactivate Travel" }).click()
  await expect(travelRow).toContainText("Deactivated")
  await expect(admin.getByText('Category "Travel" deactivated. It stays on the reports that already use it.')).toBeVisible()

  await employee.goto("/reports/new")
  await expect(employee.getByRole("combobox", { name: "Category" }).getByRole("option", { name: "Travel" })).toHaveCount(0)

  const reports = await employee.request.get("/api/reports")
  expect(reports.ok()).toBeTruthy()
  const reportList = (await reports.json()).data as Array<{ id: number; title: string }>
  const existing = reportList.find((report) => report.title === "Client visit - Mumbai")
  expect(existing).toBeTruthy()
  const detail = await employee.request.get(`/api/reports/${existing!.id}`)
  expect(detail.ok()).toBeTruthy()
  expect((await detail.json()).data.lines[0].category.name).toBe("Travel")

  await travelRow.getByRole("button", { name: "Activate Travel" }).click()
  await expect(travelRow).toContainText("Active")

  let categoryRequests = 0
  employee.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/admin/categories") categoryRequests += 1
  })
  await employee.goto("/admin/categories")
  await expect(employee.getByText("You do not have access to this page")).toBeVisible()
  expect(categoryRequests).toBe(0)

  const denied = await employee.request.get("/api/admin/categories")
  expect(denied.status()).toBe(403)
  expect((await denied.json()).message).toBe("You do not have access to this page")

  await adminContext.close()
  await employeeContext.close()
})
