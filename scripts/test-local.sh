#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "[SMOKE] Using LocalStack at $ENDPOINT ($REGION)"

# ---- DynamoDB: list/create/put/get (replace with real table names) ----
TABLE_AUCTIONS="AuctionsTable-local"

aws --endpoint-url="$ENDPOINT" dynamodb list-tables | jq .

aws --endpoint-url="$ENDPOINT" dynamodb describe-table --table-name "$TABLE_AUCTIONS" >/dev/null \
  || { echo "[SMOKE] Missing table $TABLE_AUCTIONS"; exit 1; }

# ---- SQS: create, send, receive (replace queue name) ----
QUEUE_URL=$(aws --endpoint-url="$ENDPOINT" sqs get-queue-url --queue-name "MailQueue-local" 2>/dev/null | jq -r .QueueUrl || true)
if [ -z "${QUEUE_URL:-}" ]; then
  echo "[SMOKE] Creating SQS queue MailQueue-local"
  aws --endpoint-url="$ENDPOINT" sqs create-queue --queue-name "MailQueue-local" >/dev/null
  QUEUE_URL=$(aws --endpoint-url="$ENDPOINT" sqs get-queue-url --queue-name "MailQueue-local" | jq -r .QueueUrl)
fi
aws --endpoint-url="$ENDPOINT" sqs send-message --queue-url "$QUEUE_URL" --message-body '{"ping":"ok"}' >/dev/null
aws --endpoint-url="$ENDPOINT" sqs receive-message --queue-url "$QUEUE_URL" --max-number-of-messages 1 | jq .


# ---- SES: stub identity ----
aws --endpoint-url="$ENDPOINT" ses verify-email-identity --email-address test@example.com >/dev/null || true

# ---- S3: Frontend Bucket ----
if ! aws --endpoint-url="$ENDPOINT" s3 ls "s3://auction-frontend-local" >/dev/null 2>&1; then
  echo "[SMOKE] Missing bucket auction-frontend-local"
  exit 1
fi

echo "[SMOKE] OK"
