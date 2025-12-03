#!/bin/bash
set -euo pipefail

# Configuration
# Inside the tester container, these env vars are set by docker-compose.test.yml
API_URL="${API_BASE_URL:-http://host.docker.internal:3000}"
# If LAMBDA_RPC_ENDPOINT is not set, infer it (replace 3000 with 3002)
LAMBDA_URL="${LAMBDA_RPC_ENDPOINT:-$(echo "$API_URL" | sed 's/3000/3002/')}"
# LocalStack endpoint (for bootstrapping)
LOCALSTACK_URL="${LOCALSTACK_ENDPOINT:-http://localstack:4566}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "Running E2E Tests..."
echo "API URL: $API_URL"
echo "Lambda URL: $LAMBDA_URL"
echo "LocalStack URL: $LOCALSTACK_URL"

# 1. Bootstrap LocalStack (ensure resources exist)
echo "[E2E] Bootstrapping LocalStack..."
# Assuming scripts are at /app/scripts inside the container
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/localstack-bootstrap.sh" "$LOCALSTACK_URL" "$REGION"

# 2. Run Verification Flow
echo "[E2E] Starting Auction Flow Verification..."

# Check dependencies (jq is installed in tester)
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required."
    exit 1
fi

echo "[1/4] Creating Auction..."
# Calculate a past timestamp (5 seconds ago) using Python to ensure expiration
ENDING_AT=$(python3 -W ignore -c 'import datetime; print((datetime.datetime.utcnow() - datetime.timedelta(seconds=5)).isoformat() + "Z")')
echo "Ending At: $ENDING_AT"

# Capture response
RESPONSE=$(curl -s -f -X POST "$API_URL/auction" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"E2E Test Auction\", \"endingAt\": \"$ENDING_AT\"}") || {
    echo "Error: Failed to connect to $API_URL/auction"
    exit 1
}

echo "Response: $RESPONSE"
AUCTION_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ "$AUCTION_ID" == "null" ] || [ -z "$AUCTION_ID" ]; then
    echo "Error: Failed to create auction."
    exit 1
fi
echo "Auction ID: $AUCTION_ID"

echo "[2/4] Placing Bid..."
curl -s -f -X PATCH "$API_URL/auction/$AUCTION_ID/bid" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}' | jq . || {
    echo "Error: Failed to place bid."
    exit 1
}

echo "[3/4] Triggering processAuctions Lambda..."
# We invoke the lambda exposed by serverless-offline on the host
aws --endpoint-url="$LAMBDA_URL" lambda invoke \
  --function-name auction-service-local-processAuctions \
  --payload '{}' \
  response.json || {
    echo "Error: Failed to invoke lambda at $LAMBDA_URL"
    exit 1
}

echo "Lambda Response:"
if [ -f response.json ]; then
  cat response.json
  rm response.json
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
