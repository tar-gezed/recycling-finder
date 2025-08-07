from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        geolocation={"latitude": 45.180174, "longitude": 5.726485},
        viewport={'width': 1280, 'height': 1024}
    )
    page = context.new_page()

    try:
        page.goto("http://localhost:3000")

        # Wait for the map to be ready and for markers to appear
        page.wait_for_selector(".leaflet-marker-icon", timeout=30000)

        # Click on a marker. We will try to click the first one.
        # If it's not in the viewport, we'll try the next one.
        markers = page.query_selector_all(".leaflet-marker-icon")
        if markers:
            for marker in markers:
                try:
                    marker.click(timeout=5000) # 5s timeout for each marker click
                    break # if click is successful, break the loop
                except Exception:
                    continue # if click fails, try the next marker
            else: # this will be executed if the loop finishes without a break
                print("Could not click on any marker.")
                return
        else:
            print("No markers found on the map.")
            return

        # Wait for the popup to appear
        page.wait_for_selector(".leaflet-popup", timeout=10000)

        # Take a screenshot of the popup
        popup_element = page.query_selector(".leaflet-popup")
        if popup_element:
            popup_element.screenshot(path="jules-scratch/verification/verification.png")
        else:
            print("Popup not found.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
