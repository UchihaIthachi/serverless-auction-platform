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
# Calculate a past timestamp (5 seconds ago) to ensure the auction is ready to be closed immediately.
# Using UTC to match server time. Suppress deprecation warnings for cleaner output.
ENDING_AT=$(python3 -W ignore -c 'import datetime; print((datetime.datetime.utcnow() - datetime.timedelta(seconds=5)).isoformat() + "Z")')
echo "Ending At: $ENDING_AT"

# Capture response or fail if connection refused/HTTP error
if ! RESPONSE=$(curl -s -f -X POST "$API_URL/auction" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Automated Verification Auction\", \"endingAt\": \"$ENDING_AT\"}"); then
    echo "Error: Failed to create auction. Could not connect to $API_URL/auction or server returned an error."
    echo "Make sure the services are running (e.g., 'npm run start:local')."
    exit 1
fi

echo "Response: $RESPONSE"

AUCTION_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ "$AUCTION_ID" == "null" ] || [ -z "$AUCTION_ID" ]; then
    echo "Error: Failed to create auction. Response was: $RESPONSE"
    exit 1
fi

echo "Auction ID: $AUCTION_ID"

echo "[2/4] Placing Bid..."
if ! curl -s -f -X PATCH "$API_URL/auction/$AUCTION_ID/bid" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}' | jq .; then
    echo "Error: Failed to place bid."
    exit 1
fi

echo "[3/4] Triggering processAuctions Lambda (port 3002)..."
# Invoke the lambda directly via serverless-offline's RPC port
if ! aws --endpoint-url="$LAMBDA_URL" lambda invoke \
  --function-name auction-service-local-processAuctions \
  --payload '{}' \
  response.json; then
    echo "Error: Failed to invoke Lambda at $LAMBDA_URL."
    exit 1
fi

echo "Lambda Response:"
if [ -f response.json ]; then
  cat response.json
  rm response.json
else
  echo "Error: No response.json found."
fi

echo ""
echo "[4/4] Verifying Auction Status..."
FINAL_STATUS=$(curl -s "$API_URL/auction/$AUCTION_ID")
echo "$FINAL_STATUS" | jq .

STATUS=$(echo "$FINAL_STATUS" | jq -r '.status')

if [ "$STATUS" == "CLOSED" ]; then
    echo "✅ Success! Auction is CLOSED."
else
    echo "⚠️ Auction status is $STATUS (Expected: CLOSED)."
    exit 1
fi
