#!/usr/bin/env bash
set -euo pipefail
ENDPOINT="${1:-http://localhost:4566}"
REGION="${2:-us-east-1}"

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION="${REGION}"

echo "[Bootstrap] Using endpoint: $ENDPOINT"

# DynamoDB Tables
echo "[Bootstrap] Creating DynamoDB table: AuctionsTable-local..."
aws --endpoint-url="$ENDPOINT" dynamodb create-table \
  --table-name AuctionsTable-local \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST > /dev/null || true

# SQS Queues
echo "[Bootstrap] Creating SQS queue: MailQueue-local..."
aws --endpoint-url="$ENDPOINT" sqs create-queue --queue-name MailQueue-local > /dev/null || true

# S3 Buckets
echo "[Bootstrap] Creating S3 bucket: auctions-bucket-sj19asxm-local..."
aws --endpoint-url="$ENDPOINT" s3 mb s3://auctions-bucket-sj19asxm-local > /dev/null || true

# SES Identity
echo "[Bootstrap] Verifying SES email identity: test@example.com..."
aws --endpoint-url="$ENDPOINT" ses verify-email-identity --email-address test@example.com > /dev/null || true

echo "[Bootstrap] Done."
