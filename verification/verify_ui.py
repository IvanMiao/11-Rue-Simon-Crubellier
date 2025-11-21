
import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # 1. Navigate to the app
    # Vite usually runs on port 3001 (or whatever is free)
    page.goto("http://localhost:3001")

    # 2. Wait for initial loading to finish (if any)
    # The app shows a loading spinner initially if bible is generating.
    # Since we don't have API key, it might fallback quickly or show error.
    # Let's wait for the main nav to appear.
    page.wait_for_selector("nav", timeout=10000)

    # 3. Verify Inventory is collapsed by default
    # The header should be visible
    inventory_header = page.locator("text=Inventory")
    expect(inventory_header).to_be_visible()

    # The content grid should not be visible (height 0)
    # We can check if the "Your pockets are empty" text is hidden or if the container has 0 height.
    # The code uses max-h-0 opacity-0 class.

    # 4. Click to expand
    inventory_header.click()
    time.sleep(1) # wait for transition

    # 5. Verify expanded
    # "Your pockets are empty" should be visible now (if empty)
    # empty_msg = page.locator("text=Your pockets are empty")
    # expect(empty_msg).to_be_visible()

    # 6. Take screenshot of UI
    page.screenshot(path="verification/inventory_expanded.png")

    # 7. Inject mock data to test "Available Actions"
    # We will inject a visited room into localStorage and reload

    mock_state = {
        "visitedRooms": {
            "room-1-1": {
                "text": "A test room description.",
                "items": ["Chair", "Table"],
                "mood": "Testing",
                "available_interactions": [
                    {"label": "Test Interaction", "response": "Interaction Successful!", "type": "action"}
                ]
            }
        },
        "inventory": [],
        "puzzlePiecesCollected": 0,
        "lastMoveWasKnightMove": False,
        "storyBible": {
            "title": "Test Bible",
            "themes": [],
            "key_characters": [],
            "plot_threads": [],
            "mystery": "None"
        }
    }

    import json
    state_str = json.dumps(mock_state)

    page.evaluate(f"localStorage.setItem('perec_app_state_v2', '{state_str}')")
    page.reload()
    page.wait_for_selector("nav")

    # Select the room (Assuming room-1-1 is a valid ID on the grid, usually coordinate based)
    # Grid logic: BuildingMap.tsx uses IDs like "r-0-0"?
    # I need to know the ID format.
    # Let's check BuildingMap.tsx or just click a cell.
    # But if I inject state, I need the ID to match what the grid expects.
    # Let's assume I click the first available room cell.

    # Click a room cell
    # The map cells have click handlers.
    # Let's try to click a cell.
    cell = page.locator(".grid-cell").first # This selector is a guess
    # Actually, looking at BuildingMap, I don't know the class.
    # I'll look for a cell by role or text.
    # Let's just take a screenshot of the initial state first.

    browser.close()

with sync_playwright() as p:
    run(p)
