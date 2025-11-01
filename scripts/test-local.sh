#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "[SMOKE] Using LocalStack at $ENDPOINT ($REGION)"

# ---- DynamoDB: list/create/put/get (replace with real table names) ----
TABLE_AUCTIONS="AuctionsTable-local"

aws --endpoint-url="$ENDPOINT" dynamodb list-tables | jq .

aws --endpoint-url="$ENDPOINT" dynamodb describe-table --table-name "$TABLE_AUCTIONS" >/dev/null 2>&1 || {
  echo "[SMOKE] Creating $TABLE_AUCTIONS"
  aws --endpoint-url="$ENDPOINT" dynamodb create-table \
    --table-name "$TABLE_AUCTIONS" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
}
aws --endpoint-url="$ENDPOINT" dynamodb describe-table --table-name "$TABLE_AUCTIONS" >/dev/null

# ---- SQS: create, send, receive (replace queue name) ----
QUEUE_URL=$(aws --endpoint-url="$ENDPOINT" sqs get-queue-url --queue-name "MailQueue-local" 2>/dev/null | jq -r .QueueUrl || true)
if [ -z "${QUEUE_URL:-}" ]; then
  echo "[SMOKE] Creating SQS queue MailQueue-local"
  aws --endpoint-url="$ENDPOINT" sqs create-queue --queue-name "MailQueue-local" >/dev/null
  QUEUE_URL=$(aws --endpoint-url="$ENDPOINT" sqs get-queue-url --queue-name "MailQueue-local" | jq -r .QueueUrl)
fi
aws --endpoint-url="$ENDPOINT" sqs send-message --queue-url "$QUEUE_URL" --message-body '{"ping":"ok"}' >/dev/null
aws --endpoint-url="$ENDPOINT" sqs receive-message --queue-url "$QUEUE_URL" --max-number-of-messages 1 | jq .

# ---- SNS: create/publish (replace topic) ----
TOPIC_ARN=$(aws --endpoint-url="$ENDPOINT" sns create-topic --name "auction-notifications-local" | jq -r .TopicArn)
aws --endpoint-url="$ENDPOINT" sns publish --topic-arn "$TOPIC_ARN" --message "hello from smoke" >/dev/null

# ---- SES: stub identity ----
aws --endpoint-url="$ENDPOINT" ses verify-email-identity --email-address test@example.com >/dev/null || true

echo "[SMOKE] OK"
