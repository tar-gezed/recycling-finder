import re
from playwright.sync_api import sync_playwright, expect, Page

def verify_recycling_app(page: Page):
    """
    This script verifies the new features of the recycling finder app.
    - Sets a mock geolocation.
    - Checks if the popup content is translated and the 'M'y rendre' button is present.
    - Checks if the 'Me Localiser' button works.
    """
    # 1. Navigate to the app.
    page.goto("http://localhost:3000/recycling-finder/")

    # 2. Wait for the map to be ready and for markers to appear.
    # The user marker is a good indicator that the initial location is set.
    expect(page.locator("svg > circle > circle")).to_be_visible(timeout=20000)

    # Wait for recycling markers to load (they are leaflet-marker-icon)
    # Let's wait for at least one to be visible.
    expect(page.locator(".leaflet-marker-icon").nth(1)).to_be_visible(timeout=20000)

    # 3. Click on a recycling marker to open a popup.
    # We click the second marker to avoid the user's location marker.
    recycling_marker = page.locator(".leaflet-marker-icon").nth(1)
    recycling_marker.click()

    # 4. Assertions on the popup content.
    popup = page.locator(".leaflet-popup-content")
    expect(popup).to_be_visible()

    # Check for translated text. We expect "Type :" and "Matériaux acceptés :".
    expect(popup.get_by_text("Type :")).to_be_visible()
    expect(popup.get_by_text("Matériaux acceptés :")).to_be_visible()

    # Check for the "M'y rendre" button.
    direction_button = popup.get_by_role("link", name="M'y rendre")
    expect(direction_button).to_be_visible()
    expect(direction_button).to_have_attribute("target", "_blank")
    expect(direction_button).to_have_attribute("href", re.compile(r"https://www.google.com/maps/dir/"))

    # 5. Take a screenshot of the popup.
    page.screenshot(path="jules-scratch/verification/screenshot_popup.png")

    # 6. Test the "Me Localiser" button.
    # First, let's pan the map away from the user's location to see the effect.
    map_locator = page.locator("#app > div.main-layout > main > div > div.map-container > div.leaflet-pane.leaflet-map-pane")
    if map_locator.is_visible():
        map_locator.drag_to(page.locator("#app"), force=True) # drag it somewhere else
        page.wait_for_timeout(1000) # wait for drag to settle

    # Now click the "Me Localiser" button
    locate_button = page.get_by_role("button", name="Me localiser")
    locate_button.click()

    # Wait for the map to pan back. A simple timeout should be enough here
    # as the setView animation is usually fast.
    page.wait_for_timeout(2000)

    # 7. Take a screenshot of the recentered map.
    page.screenshot(path="jules-scratch/verification/screenshot_recenter.png")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a context with mock geolocation
        context = browser.new_context(
            geolocation={'latitude': 45.1823517377723, 'longitude': 5.724709750162596},
            permissions=['geolocation']
        )
        page = context.new_page()

        try:
            verify_recycling_app(page)
            print("Verification script ran successfully.")
        except Exception as e:
            print(f"An error occurred: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
