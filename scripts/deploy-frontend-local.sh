#!/usr/bin/env bash
set -euo pipefail

ENDPOINT_URL="${ENDPOINT_URL:-http://localhost:4566}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
FRONTEND_BUCKET="${FRONTEND_BUCKET:-auction-frontend-local}"
BUILD_DIR="${BUILD_DIR:-out}"

echo "[Frontend] Building app from ${FRONTEND_DIR}..."
pushd "${FRONTEND_DIR}" >/dev/null
npm install
npm run build
popd >/dev/null

echo "[Frontend] Syncing ${FRONTEND_DIR}/${BUILD_DIR} to s3://${FRONTEND_BUCKET}/..."
aws --endpoint-url="${ENDPOINT_URL}" s3 sync "${FRONTEND_DIR}/${BUILD_DIR}" "s3://${FRONTEND_BUCKET}/" --delete

echo "[Frontend] Deployed to LocalStack S3 bucket: ${FRONTEND_BUCKET}"
echo "[Frontend] Try: curl -s ${ENDPOINT_URL}/${FRONTEND_BUCKET}/index.html | head"
