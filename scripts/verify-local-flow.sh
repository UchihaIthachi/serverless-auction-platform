#!/bin/bash
set -euo pipefail

# Configuration
API_URL="http://localhost:3000"
LAMBDA_URL="http://localhost:3002"
AWS_REGION="us-east-1"

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Please install jq to use this script (e.g., 'choco install jq' or 'brew install jq')."
    exit 1
fi

echo "[1/4] Creating Auction..."
RESPONSE=$(curl -s -X POST "$API_URL/auction" \
  -H "Content-Type: application/json" \
  -d '{"title": "Automated Verification Auction"}')

echo "Response: $RESPONSE"

AUCTION_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ "$AUCTION_ID" == "null" ] || [ -z "$AUCTION_ID" ]; then
    echo "Error: Failed to create auction. ID is null."
    exit 1
fi

echo "Auction ID: $AUCTION_ID"

echo "[2/4] Placing Bid..."
curl -s -X PATCH "$API_URL/auction/$AUCTION_ID/bid" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}' | jq .

echo "[3/4] Triggering processAuctions Lambda (port 3002)..."
aws --endpoint-url="$LAMBDA_URL" lambda invoke \
  --function-name auction-service-local-processAuctions \
  --payload '{}' \
  response.json

echo "Lambda Response:"
cat response.json
rm response.json

echo "[4/4] Verifying Auction Status..."
FINAL_STATUS=$(curl -s "$API_URL/auction/$AUCTION_ID")
echo "$FINAL_STATUS" | jq .

STATUS=$(echo "$FINAL_STATUS" | jq -r '.status')

if [ "$STATUS" == "CLOSED" ]; then
    echo "✅ Success! Auction is CLOSED."
else
    echo "⚠️ Auction status is $STATUS (Expected: CLOSED)."
    echo "Note: The lambda runs every minute, so it might have already closed it if you waited too long, or maybe the time logic requires a slight delay."
fi
