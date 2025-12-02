#!/usr/bin/env bash
set -euo pipefail

API_URL="${1:-}"
BUCKET_NAME="${2:-}"

if [ -z "$API_URL" ] || [ -z "$BUCKET_NAME" ]; then
  echo "Usage: $0 <API_URL> <BUCKET_NAME>"
  exit 1
fi

FRONTEND_DIR="frontend"
BUILD_DIR="out"

echo "[Deploy] API URL: $API_URL"
echo "[Deploy] Bucket: $BUCKET_NAME"

# Build if out doesn't exist
if [ ! -d "$FRONTEND_DIR/$BUILD_DIR" ]; then
    echo "[Deploy] Building frontend..."
    pushd "$FRONTEND_DIR" >/dev/null
    npm install
    npm run build
    popd >/dev/null
fi

# Generate config.js
echo "[Deploy] Generating config.js..."
cat > "$FRONTEND_DIR/$BUILD_DIR/config.js" <<EOF
window.AUCTION_API_BASE = "$API_URL";
EOF

# Sync to S3
echo "[Deploy] Syncing to S3..."
aws s3 sync "$FRONTEND_DIR/$BUILD_DIR" "s3://$BUCKET_NAME" --delete

echo "[Deploy] Done."
