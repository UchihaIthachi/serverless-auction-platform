#!/bin/bash
set -e

# Default values
LOCALSTACK_ENDPOINT="http://localhost:4566"
REGION="us-east-1"

echo "Starting LocalStack..."
docker compose up -d localstack

echo "Waiting for LocalStack..."
# Loop until LocalStack is ready
until aws --endpoint-url="$LOCALSTACK_ENDPOINT" sts get-caller-identity >/dev/null 2>&1; do
  echo "[wait] LocalStack not ready yet..."
  sleep 2
done

echo "Bootstrapping LocalStack..."
bash scripts/localstack-bootstrap.sh "$LOCALSTACK_ENDPOINT" "$REGION"
