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

# Resolve Auction API Gateway base URL
echo "[Frontend] Resolving API Gateway..."
API_ID=$(aws --endpoint-url="${ENDPOINT_URL}" apigateway get-rest-apis \
  --query "items[?name=='auction-service'].id" --output text 2>/dev/null || true)

if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
    # LocalStack API Gateway URL pattern: http://localhost:4566/restapis/<api_id>/<stage>/_user_request_
    API_BASE="${ENDPOINT_URL}/restapis/${API_ID}/local/_user_request_"
    echo "[Frontend] Found LocalStack API Gateway: ${API_BASE}"
    
    cat > "${FRONTEND_DIR}/${BUILD_DIR}/config.js" <<EOF
window.AUCTION_API_BASE = "${API_BASE}";
EOF

else
    echo "[Frontend] No deployed 'auction-service' found in LocalStack API Gateway."
    echo "[Frontend] Defaulting to http://localhost:3000 (serverless-offline)."
    
    cat > "${FRONTEND_DIR}/${BUILD_DIR}/config.js" <<EOF
window.AUCTION_API_BASE = "http://localhost:3000";
EOF
fi

echo "[Frontend] Syncing ${FRONTEND_DIR}/${BUILD_DIR} to s3://${FRONTEND_BUCKET}/..."
aws --endpoint-url="${ENDPOINT_URL}" s3 sync "${FRONTEND_DIR}/${BUILD_DIR}" "s3://${FRONTEND_BUCKET}/" --delete

echo "[Frontend] Deployed to LocalStack S3 bucket: ${FRONTEND_BUCKET}"
echo "[Frontend] Try: curl -s ${ENDPOINT_URL}/${FRONTEND_BUCKET}/index.html | head"
