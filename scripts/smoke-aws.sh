#!/usr/bin/env bash
# Smoke test against the deployed dev stage. Needs one Auth0 access token (TOKEN); a second user's
# token (TOKEN2) adds a real bid. Tokens are only sent to your own API, never printed.
#   TOKEN=... [TOKEN2=...] bash scripts/smoke-aws.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
STAGE="${STAGE:-dev}"; REGION="${REGION:-us-east-1}"
[ -n "${TOKEN:-}" ] || { echo "export TOKEN=<Auth0 access token>"; exit 1; }
API=$(cd auction-service && npx serverless info --stage "$STAGE" --region "$REGION" | grep -oE 'https://[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com/'"$STAGE" | head -1)
[ -n "$API" ] || { echo "auction API not found; deploy first"; exit 1; }
echo "API $API"
pass=0; fail=0
check() { local name=$1 want=$2 got=$3; if [ "$got" = "$want" ]; then echo "  PASS $name ($got)"; pass=$((pass+1)); else echo "  FAIL $name: want $want, got $got"; fail=$((fail+1)); fi; }
req() { curl -s -o /tmp/smoke-body -w '%{http_code}' "$@"; }

check "no token -> 401"          401 "$(req "$API/auctions?status=OPEN")"
check "bad token -> 401"         401 "$(req -H 'Authorization: Bearer nope' "$API/auctions?status=OPEN")"
check "create auction -> 201"    201 "$(req -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"title":"Smoke test lamp"}' "$API/auction")"
ID=$(python3 -c 'import json; print(json.load(open("/tmp/smoke-body"))["id"])')
echo "  auction $ID"
check "get auction -> 200"       200 "$(req -H "Authorization: Bearer $TOKEN" "$API/auction/$ID")"
check "list open -> 200"         200 "$(req -H "Authorization: Bearer $TOKEN" "$API/auctions?status=OPEN")"
check "seller bids own -> 403"   403 "$(req -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"amount":10}' "$API/auction/$ID/bid")"
if [ -n "${TOKEN2:-}" ]; then
  check "other user bids 10 -> 200" 200 "$(req -X PATCH -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' -d '{"amount":10}' "$API/auction/$ID/bid")"
  check "lower bid 5 -> 403"        403 "$(req -X PATCH -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' -d '{"amount":5}' "$API/auction/$ID/bid")"
else
  echo "  skip real bid (set TOKEN2 for a second user)"
fi
echo; echo "passed $pass, failed $fail"
echo "The auction closes after 1 hour; processAuctions then queues the emails (check: Lambda sendMail logs)."
[ "$fail" = 0 ]
