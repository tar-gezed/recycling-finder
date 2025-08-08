import { test, expect } from "@playwright/test";

test("has title and map is visible", async ({ page }) => {
  await page.goto("http://localhost:3000/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Recycling Finder/);

  // Wait for the map element to be visible
  const map = page.locator(".map-container");
  await expect(map).toBeVisible();

  // Take a screenshot to visually verify the UI
  await page.screenshot({ path: "tests/screenshot.png" });
});
