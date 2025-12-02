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
RECREATE_TABLE="false"
if aws --endpoint-url="$ENDPOINT" dynamodb list-tables --query "TableNames" | grep -q "AuctionsTable-local"; then
  # Check if the required GSI exists
  if ! aws --endpoint-url="$ENDPOINT" dynamodb describe-table --table-name AuctionsTable-local | grep -q "statusAndEndDate"; then
    echo "[Bootstrap] Table 'AuctionsTable-local' exists but is missing GSI 'statusAndEndDate'. Recreating..."
    aws --endpoint-url="$ENDPOINT" dynamodb delete-table --table-name AuctionsTable-local
    echo "[Bootstrap] Waiting for table deletion..."
    aws --endpoint-url="$ENDPOINT" dynamodb wait table-not-exists --table-name AuctionsTable-local
    RECREATE_TABLE="true"
  else
    echo "[Bootstrap] Table 'AuctionsTable-local' exists and has required GSI."
  fi
else
  RECREATE_TABLE="true"
fi

if [ "$RECREATE_TABLE" == "true" ]; then
  aws --endpoint-url="$ENDPOINT" dynamodb create-table \
    --table-name AuctionsTable-local \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=status,AttributeType=S \
        AttributeName=endingAt,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"statusAndEndDate\",
                \"KeySchema\": [
                    {\"AttributeName\":\"status\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"endingAt\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {
                    \"ProjectionType\": \"ALL\"
                }
            }
        ]" \
    --billing-mode PAY_PER_REQUEST > /dev/null
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

# Frontend S3 Website
FRONTEND_BUCKET="auction-frontend-local"
echo "[Bootstrap] Creating S3 bucket for frontend: ${FRONTEND_BUCKET}..."

if ! aws --endpoint-url="$ENDPOINT" s3api head-bucket --bucket "${FRONTEND_BUCKET}" > /dev/null 2>&1; then
  aws --endpoint-url="$ENDPOINT" s3 mb "s3://${FRONTEND_BUCKET}" > /dev/null
else
  echo "[Bootstrap] Frontend bucket already exists."
fi

echo "[Bootstrap] Enabling static website hosting for frontend bucket..."
aws --endpoint-url="$ENDPOINT" s3 website "s3://${FRONTEND_BUCKET}" \
  --index-document index.html \
  --error-document index.html

echo "[Bootstrap] Applying public-read bucket policy for frontend (LocalStack only)..."
cat > auction-frontend-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${FRONTEND_BUCKET}/*"
    }
  ]
}
EOF

aws --endpoint-url="$ENDPOINT" s3api put-bucket-policy \
  --bucket "${FRONTEND_BUCKET}" \
  --policy file://auction-frontend-policy.json

# Auth Service Secrets
if [ ! -f "auth-service/secret.pem" ]; then
  echo "[Bootstrap] Creating auth-service/secret.pem..."
  cat > auth-service/secret.pem << EOF
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890abcdefghij
klmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijkl
mnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmn
opqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop
qrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqr
stuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklwc==
-----END PUBLIC KEY-----
EOF
else
  echo "[Bootstrap] auth-service/secret.pem already exists."
fi

echo "[Bootstrap] Done."
