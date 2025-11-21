
import time
import json
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # 1. Navigate
    page.goto("http://localhost:3001")
    page.wait_for_selector("nav", timeout=10000)

    # 2. Inject Mock Data for Room 3-1 (BARTLEBOOTH)
    mock_state = {
        "visitedRooms": {
            "3-1": {
                "text": "BARTLEBOOTH'S STUDY. A heavy silence hangs here.",
                "items": ["Jigsaw Puzzle", "Magnifying Glass"],
                "mood": "Melancholic",
                "available_interactions": [
                    {"label": "Examine Puzzle", "response": "It is a wooden puzzle of a port scene. One piece is missing.", "type": "action"},
                    {"label": "Call Valene", "response": "You call out, but only the echo answers.", "type": "dialogue"}
                ]
            }
        },
        "inventory": [],
        "puzzlePiecesCollected": 0,
        "lastMoveWasKnightMove": False,
        "storyBible": {
            "title": "Test Bible",
            "themes": ["Exhaustion"],
            "key_characters": [],
            "plot_threads": [],
            "mystery": "None"
        }
    }

    state_str = json.dumps(mock_state).replace("'", "\\'") # Escape single quotes
    # Use json.stringify logic in JS side to be safer
    page.evaluate(f"""
        localStorage.setItem('perec_app_state_v2', JSON.stringify({json.dumps(mock_state)}));
    """)

    # 3. Reload to apply state
    page.reload()
    page.wait_for_selector("nav")

    # 4. Click Room 3-1 on the Map
    # The buttons contain the text "BARTLEBOOTH"
    # We can find it by text.
    room_btn = page.locator("button", has_text="BARTLEBOOTH").first
    room_btn.click()

    # 5. Wait for content to load (it should be cached, so instant)
    time.sleep(1)

    # 6. Verify "Available Actions" section
    expect(page.locator("text=Available Actions")).to_be_visible()

    # 7. Click an action
    action_btn = page.locator("button", has_text="Examine Puzzle")
    action_btn.click()

    # 8. Verify Response text appears
    # "It is a wooden puzzle..."
    expect(page.locator("text=It is a wooden puzzle")).to_be_visible()

    # 9. Screenshot
    page.screenshot(path="verification/interactions_test.png")

    browser.close()

with sync_playwright() as p:
    run(p)
