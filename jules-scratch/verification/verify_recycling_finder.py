from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
      geolocation={"latitude": 48.85837, "longitude": 2.294481},
      permissions=["geolocation"],
    )
    page = context.new_page()

    page.goto("http://localhost:3000")

    # Wait for the map to be ready
    page.wait_for_selector(".leaflet-container")

    # Wait for markers to appear
    page.wait_for_selector(".leaflet-marker-icon")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
