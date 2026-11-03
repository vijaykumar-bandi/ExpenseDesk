import { test, expect } from "@playwright/test"

test("guest receives the same recovery confirmation and an invalid reset link can be replaced", async ({ page }) => {
  await page.goto("/forgot-password")
  await page.getByRole("textbox", { name: "Email" }).fill("unknown-person@expensedesk.test")
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByRole("status")).toHaveText("If that email has an account, a reset link has been sent")

  await page.goto("/reset-password/invalid-token")
  await expect(page.getByRole("textbox", { name: "New password", exact: true })).toHaveAttribute("minlength", "12")
  await page.getByRole("textbox", { name: "New password", exact: true }).fill("ReplacementPass!2026")
  await page.getByRole("textbox", { name: "Confirm new password" }).fill("ReplacementPass!2026")
  await page.getByRole("button", { name: "Set new password" }).click()
  await expect(page.getByRole("alert")).toHaveText("This reset link is no longer valid")
  await expect(page.getByRole("link", { name: "Send a new link" })).toHaveAttribute("href", "/forgot-password")
})
