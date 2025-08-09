import { test, expect } from "@playwright/test";

// Set geolocation for all tests in this file.
test.use({
  geolocation: { latitude: 45.1823517377723, longitude: 5.724709750162596 },
  permissions: ["geolocation"],
});

test("Verify new features: popup content and locate me button", async ({
  page,
}) => {
  // 1. Navigate to the app. The dev server runs it at this subpath.
  await page.goto("http://localhost:3000/recycling-finder/");

  // 2. Wait for the map to be ready and for the user marker to appear.
  const userMarkerLocator = page.locator('svg[viewBox="0 0 10 10"]');
  await expect(userMarkerLocator).toBeVisible({ timeout: 20000 });

  // 3. Wait for recycling markers to load and click on one.
  const recyclingMarker = page.locator(".leaflet-marker-icon").nth(1);
  await expect(recyclingMarker).toBeVisible({ timeout: 20000 });
  await recyclingMarker.click();

  // 4. Assertions on the popup content.
  const popup = page.locator(".leaflet-popup-content");
  await expect(popup).toBeVisible();

  // Check for translated text.
  await expect(popup.getByText("Type :")).toBeVisible();
  await expect(popup.getByText("Matériaux acceptés :")).toBeVisible();

  // Check for the "M'y rendre" button and its attributes.
  const directionButton = popup.getByRole("link", { name: "M'y rendre" });
  await expect(directionButton).toBeVisible();
  await expect(directionButton).toHaveAttribute("target", "_blank");
  await expect(directionButton).toHaveAttribute(
    "href",
    /https:\/\/www.google.com\/maps\/dir\//
  );

  // 5. Take a screenshot of the popup.
  await page.screenshot({
    path: "jules-scratch/verification/screenshot_popup.png",
  });

  // 6. Test the "Me Localiser" button.
  // Pan the map away to see the effect.
  const mapLocator = page.locator(".leaflet-pane.leaflet-map-pane");
  await mapLocator.dragTo(page.locator("body"), {
    force: true,
    targetPosition: { x: 100, y: 100 },
  });
  await page.waitForTimeout(1000); // Wait for drag to settle.

  // Click the "Me Localiser" button.
  const locateButton = page.getByRole("button", { name: "Me localiser" });
  await locateButton.click();

  // Wait for the map to pan back.
  await page.waitForTimeout(2000);

  // 7. Take a screenshot of the recentered map.
  await page.screenshot({
    path: "jules-scratch/verification/screenshot_recenter.png",
  });
});
