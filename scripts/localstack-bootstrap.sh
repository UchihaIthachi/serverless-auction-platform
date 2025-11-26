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
if ! aws --endpoint-url="$ENDPOINT" dynamodb list-tables --query "TableNames" | grep -q "AuctionsTable-local"; then
  aws --endpoint-url="$ENDPOINT" dynamodb create-table \
    --table-name AuctionsTable-local \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST > /dev/null
else
  echo "[Bootstrap] DynamoDB table AuctionsTable-local already exists."
fi

# SQS Queues
echo "[Bootstrap] Creating SQS queue: MailQueue-local..."
if ! aws --endpoint-url="$ENDPOINT" sqs get-queue-url --queue-name MailQueue-local > /dev/null 2>&1; then
  aws --endpoint-url="$ENDPOINT" sqs create-queue --queue-name MailQueue-local > /dev/null
else
  echo "[Bootstrap] SQS queue MailQueue-local already exists."
fi

# S3 Buckets
echo "[Bootstrap] Creating S3 bucket: auctions-bucket-sj19asxm-local..."
if ! aws --endpoint-url="$ENDPOINT" s3api head-bucket --bucket auctions-bucket-sj19asxm-local > /dev/null 2>&1; then
  aws --endpoint-url="$ENDPOINT" s3 mb s3://auctions-bucket-sj19asxm-local > /dev/null
else
  echo "[Bootstrap] S3 bucket auctions-bucket-sj19asxm-local already exists."
fi

# SES Identity
echo "[Bootstrap] Verifying SES email identity: test@example.com..."
if ! aws --endpoint-url="$ENDPOINT" ses get-identity-verification-attributes --identities "test@example.com" | grep -q "Success"; then
  aws --endpoint-url="$ENDPOINT" ses verify-email-identity --email-address test@example.com > /dev/null
else
  echo "[Bootstrap] SES email identity test@example.com already verified."
fi

echo "[Bootstrap] Done."
