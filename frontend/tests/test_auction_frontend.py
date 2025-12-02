import unittest
import subprocess
import time
import os
import sys
import socket
from playwright.sync_api import sync_playwright, expect

class TestAuctionFrontend(unittest.TestCase):
    server_process = None
    # Configurable BASE_URL
    PORT = 8081
    BASE_URL = os.environ.get("BASE_URL", f"http://localhost:{PORT}/index.html")
    # Toggle for Real Backend
    REAL_BACKEND = os.environ.get("REAL_BACKEND", "false").lower() == "true"

    @classmethod
    def setUpClass(cls):
        # Build Frontend
        frontend_dir = os.path.join(os.getcwd(), "frontend")
        out_dir = os.path.join(frontend_dir, "out")
        
        if not os.path.exists(out_dir):
            print("Building frontend...")
            try:
                subprocess.run(
                    ["npm", "run", "build"], 
                    cwd=frontend_dir, 
                    check=True, 
                    capture_output=True
                )
            except subprocess.CalledProcessError as e:
                print(f"Frontend build failed:\n{e.stderr.decode()}")
                sys.exit(1)

        # Start HTTP Server
        print(f"Starting HTTP server on port {cls.PORT}...")
        cls.server_process = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(cls.PORT)],
            cwd=out_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        if not cls.wait_for_server():
            print("Failed to start HTTP server.")
            cls.tearDownClass()
            sys.exit(1)

    @classmethod
    def wait_for_server(cls):
        retries = 10
        while retries > 0:
            try:
                with socket.create_connection(("localhost", cls.PORT), timeout=1):
                    return True
            except (ConnectionRefusedError, socket.timeout):
                time.sleep(0.5)
                retries -= 1
        return False

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

    def mock_route(self, pattern, status, body):
        """Helper to mock API routes when not using real backend."""
        if not self.REAL_BACKEND:
            self.page.route(pattern, lambda route: route.fulfill(
                status=status,
                content_type="application/json",
                body=body
            ))

    def test_01_login_flow(self):
        page = self.page
        page.goto(self.BASE_URL)
        
        expect(page.get_by_role("heading", name="Authentication")).to_be_visible()
        expect(page.locator("#login-form")).to_be_visible()
        expect(page.locator("#logged-in-msg")).not_to_be_visible()

        page.fill("#email", "user@test.com")
        page.click("button:text('Log In')")

        expect(page.locator("#logged-in-msg")).to_be_visible()
        expect(page.locator("#login-form")).not_to_be_visible()
        expect(page.locator("#user-email")).to_contain_text("user@test.com")

        page.click("#logout-btn")

        expect(page.locator("#login-form")).to_be_visible()
        expect(page.locator("#logged-in-msg")).not_to_be_visible()

    def test_02_create_auction_validation(self):
        page = self.page
        page.goto(self.BASE_URL)
        
        dialog_message = []
        page.on("dialog", lambda d: (dialog_message.append(d.message), d.accept()))

        page.click("button:text('Create Auction')")
        
        # Ensure the dialog was triggered
        self.assertIn("Title is required", dialog_message)

    def test_03_create_auction_success(self):
        page = self.page
        page.goto(self.BASE_URL)

        self.mock_route("**/auction", 201, '{"id": "test-uuid-123", "title": "Mock Auction", "status": "OPEN"}')

        page.fill("#auction-title", "Mock Auction")
        page.click("button:text('Create Auction')")

        expect(page.locator("#output")).to_contain_text("test-uuid-123")
        expect(page.locator("#auction-id")).to_have_value("test-uuid-123")

    def test_04_create_auction_error(self):
        page = self.page
        page.goto(self.BASE_URL)

        self.mock_route("**/auction", 500, '{"error": "Internal Server Error"}')

        page.fill("#auction-title", "Fail Auction")
        page.click("button:text('Create Auction')")

        expect(page.locator("#output")).to_contain_text('"status": 500')

    def test_05_place_bid_success(self):
        page = self.page
        page.goto(self.BASE_URL)

        page.fill("#auction-id", "test-uuid-123")
        page.fill("#bid-amount", "100")

        self.mock_route("**/auction/test-uuid-123/bid", 200, '{"id": "test-uuid-123", "highestBid": {"amount": 100}}')

        page.click("button:text('Place Bid')")

        expect(page.locator("#output")).to_contain_text('"amount": 100')

    def test_06_get_details(self):
        page = self.page
        page.goto(self.BASE_URL)

        page.fill("#auction-id", "test-uuid-123")

        self.mock_route("**/auction/test-uuid-123", 200, '{"id": "test-uuid-123", "title": "Mock Details"}')

        page.click("button:text('Get Auction Details')")

        expect(page.locator("#output")).to_contain_text("Mock Details")

if __name__ == '__main__':
    unittest.main()
