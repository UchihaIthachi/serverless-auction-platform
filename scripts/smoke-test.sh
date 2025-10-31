#!/usr/bin/env bash
set -euo pipefail
ENDPOINT="${1:-http://localhost:4566}"
REGION="${2:-us-east-1}"

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION="${REGION}"

echo "[Smoke Test] Using endpoint: $ENDPOINT"

# Verify DynamoDB Table
echo "[Smoke Test] Verifying DynamoDB table: AuctionsTable-local..."
aws --endpoint-url="$ENDPOINT" dynamodb list-tables | grep "AuctionsTable-local" > /dev/null

# Verify SQS Queue
echo "[Smoke Test] Verifying SQS queue: MailQueue-local..."
aws --endpoint-url="$ENDPOINT" sqs list-queues | grep "MailQueue-local" > /dev/null

echo "[Smoke Test] All tests passed!"
