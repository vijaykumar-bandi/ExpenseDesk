import { test, expect } from "@playwright/test"

const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "employee@expensedesk.test"
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? "EmployeePassw0rd!2026"
// A second Employee, so the role-guard journey does not use up the first one's
// 5-sign-ins-per-15-minutes allowance alongside the other journeys.
const SECOND_EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE2_EMAIL ?? "employee2@expensedesk.test"
const SECOND_EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE2_PASSWORD ?? "EmployeePassw0rd!2026"

test("guest opening / sees the sign-in page", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByRole("heading", { name: "ExpenseDesk" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
})

test("guest opening a protected page is sent to sign-in", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
})

test("wrong password shows the message and keeps the email", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(EMPLOYEE_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill("WrongPassword!2026")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect")
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(EMPLOYEE_EMAIL)
})

test("employee signs in and lands on the dashboard, then signs out", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(EMPLOYEE_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(EMPLOYEE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()

  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
})

test("employee cannot open an Administrator screen", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("textbox", { name: "Email" }).fill(SECOND_EMPLOYEE_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(SECOND_EMPLOYEE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  await page.goto("/admin/users")
  await expect(page).toHaveURL(/\/dashboard/)
})
