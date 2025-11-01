#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
API_BASE="${API_BASE_URL:-http://localhost:3000}"
AUCTION="${AUCTION_API_URL:-$API_BASE}"

echo "[E2E] Expect serverless-offline APIs to be running (auction)."
echo "[E2E] Using API base: $AUCTION"

# 1) Create auction
CREATE_OUT=$(curl -sS -X POST "$AUCTION/auction" \
  -H "Content-Type: application/json" \
  -d '{"title":"E2E Test Item"}')
echo "$CREATE_OUT" | jq .
AUC_ID=$(echo "$CREATE_OUT" | jq -r .id)
test "$AUC_ID" != "null"

# 2) Place a bid
BID_OUT=$(curl -sS -X PATCH "$AUCTION/auction/$AUC_ID/bid" \
  -H "Content-Type: application/json" \
  -d '{"amount":120}')
echo "$BID_OUT" | jq .

# 3) Close the auction
aws --endpoint-url="$ENDPOINT" lambda invoke \
  --function-name auction-service-local-processAuctions \
  --payload '{}' \
  response.json

# 4) Verify side-effects in LocalStack
echo "[E2E] Checking DynamoDB for auction $AUC_ID"
aws --endpoint-url="$ENDPOINT" dynamodb get-item \
  --table-name "AuctionsTable-local" \
  --key "{\"id\": {\"S\": \"$AUC_ID\"}}" | jq .

echo "[E2E] Poll SQS MailQueue-local"
QUEUE_URL=$(aws --endpoint-url="$ENDPOINT" sqs get-queue-url --queue-name "MailQueue-local" | jq -r .QueueUrl)
aws --endpoint-url="$ENDPOINT" sqs receive-message --queue-url "$QUEUE_URL" --max-number-of-messages 5 | jq .

echo "[E2E] OK"
