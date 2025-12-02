import unittest
import subprocess
import time
import os
import sys
from playwright.sync_api import sync_playwright

class TestAuctionFrontend(unittest.TestCase):
    server_process = None
    BASE_URL = "http://localhost:8081/index.html"

    @classmethod
    def setUpClass(cls):
        # Start HTTP server for frontend
        # Assuming we are running from repo root
        frontend_dir = os.path.join(os.getcwd(), "frontend", "out")
        if not os.path.exists(frontend_dir):
            # Fallback if out doesn't exist (e.g. build skipped), run build
             subprocess.run(["npm", "run", "build"], cwd=os.path.join(os.getcwd(), "frontend"), check=True)
        
        cls.server_process = subprocess.Popen(
            [sys.executable, "-m", "http.server", "8081"],
            cwd=frontend_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        time.sleep(2) # Give it time to start

    @classmethod
    def tearDownClass(cls):
        if cls.server_process:
            cls.server_process.terminate()
            try:
                cls.server_process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                cls.server_process.kill()

    def setUp(self):
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=True)
        self.page = self.browser.new_page()

    def tearDown(self):
        self.browser.close()
        self.playwright.stop()

    def test_01_login_flow(self):
        page = self.page
        page.goto(self.BASE_URL)
        
        # Verify initial state
        self.assertTrue(page.get_by_role("heading", name="Authentication").is_visible())
        self.assertTrue(page.locator("#login-form").is_visible())
        self.assertFalse(page.locator("#logged-in-msg").is_visible())

        # Perform Login
        page.fill("#email", "user@test.com")
        page.click("button:text('Log In')")

        # Verify Logged In State
        page.wait_for_selector("#logged-in-msg:not(.hidden)")
        self.assertTrue(page.locator("#logged-in-msg").is_visible())
        self.assertFalse(page.locator("#login-form").is_visible())
        self.assertIn("user@test.com", page.locator("#user-email").inner_text())

        # Perform Logout
        page.click("#logout-btn")

        # Verify Logged Out State
        self.assertTrue(page.locator("#login-form").is_visible())
        self.assertFalse(page.locator("#logged-in-msg").is_visible())

    def test_02_create_auction_validation(self):
        page = self.page
        page.goto(self.BASE_URL)
        
        # Handle Alert
        dialog_message = []
        page.on("dialog", lambda d: (dialog_message.append(d.message), d.accept()))

        # Click Create without title
        page.click("button:text('Create Auction')")
        
        # Verify Alert
        # Note: dialog handling might be async, but click triggers it immediately
        # Using a small wait loop or assuming sync
        # Playwright dialog handler is invoked when dialog opens.
        
        # Retry logic or wait might be needed if dialog isn't instant?
        # But click() should trigger it.
        # Let's check if we captured it.
        self.assertIn("Title is required", dialog_message)

    def test_03_create_auction_success(self):
        page = self.page
        page.goto(self.BASE_URL)

        # Mock API
        page.route("**/auction", lambda route: route.fulfill(
            status=201,
            content_type="application/json",
            body='{"id": "test-uuid-123", "title": "Mock Auction", "status": "OPEN"}'
        ))

        page.fill("#auction-title", "Mock Auction")
        page.click("button:text('Create Auction')")

        # Verify Output
        page.wait_for_selector("#output")
        # Wait for content to change from default
        page.wait_for_function("document.getElementById('output').textContent.includes('test-uuid-123')")
        
        output_text = page.locator("#output").inner_text()
        self.assertIn("test-uuid-123", output_text)

        # Verify ID input populated
        id_value = page.input_value("#auction-id")
        self.assertEqual(id_value, "test-uuid-123")

    def test_04_create_auction_error(self):
        page = self.page
        page.goto(self.BASE_URL)

        # Mock API Error
        page.route("**/auction", lambda route: route.fulfill(
            status=500,
            content_type="application/json",
            body='{"error": "Internal Server Error"}'
        ))

        page.fill("#auction-title", "Fail Auction")
        page.click("button:text('Create Auction')")

        # Verify Output
        page.wait_for_function("document.getElementById('output').textContent.includes('500')")
        output_text = page.locator("#output").inner_text()
        self.assertIn('"status": 500', output_text)

    def test_05_place_bid_success(self):
        page = self.page
        page.goto(self.BASE_URL)

        # Pre-fill ID
        page.fill("#auction-id", "test-uuid-123")
        page.fill("#bid-amount", "100")

        # Mock API
        page.route("**/auction/test-uuid-123/bid", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"id": "test-uuid-123", "highestBid": {"amount": 100}}'
        ))

        page.click("button:text('Place Bid')")

        # Verify Output
        page.wait_for_function("document.getElementById('output').textContent.includes('100')")
        output_text = page.locator("#output").inner_text()
        self.assertIn('"amount": 100', output_text)

    def test_06_get_details(self):
        page = self.page
        page.goto(self.BASE_URL)

        page.fill("#auction-id", "test-uuid-123")

        # Mock API
        page.route("**/auction/test-uuid-123", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"id": "test-uuid-123", "title": "Mock Details"}'
        ))

        page.click("button:text('Get Auction Details')")

        # Verify Output
        page.wait_for_function("document.getElementById('output').textContent.includes('Mock Details')")
        output_text = page.locator("#output").inner_text()
        self.assertIn("Mock Details", output_text)

if __name__ == '__main__':
    unittest.main()
