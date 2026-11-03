import { test, expect } from "@playwright/test"

test("sign-in screen keeps its look", async ({ page }) => {
  await page.goto("/sign-in")
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
  await expect(page).toHaveScreenshot("sign-in.png", { animations: "disabled" })
})
