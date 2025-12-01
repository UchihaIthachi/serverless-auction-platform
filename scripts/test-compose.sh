#!/bin/bash
set -e

# Ensure we have a region set for AWS CLI commands used in tests
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"

cleanup() {
  if [ -n "$AUCTION_PID" ]; then
    echo "Stopping auction service (PID: $AUCTION_PID)..."
    kill "$AUCTION_PID" || true
  fi
}

trap cleanup EXIT

echo "Starting auction service in background..."
npm run offline:auction > auction-service.log 2>&1 &
AUCTION_PID=$!

echo "Auction service PID: $AUCTION_PID"
echo "Waiting 10s for service to initialize..."
sleep 10

echo "Running Docker Compose tests..."
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tester
