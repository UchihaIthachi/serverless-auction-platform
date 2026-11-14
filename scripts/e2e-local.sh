#!/usr/bin/env bash
# End-to-end test on your laptop, $0: LocalStack (DynamoDB, SQS, S3, SES) + serverless-offline.
# Covers validation, CRUD, a concurrent-bid race, closing an auction, the mail queue and sending mail.
#   bash scripts/e2e-local.sh            # leaves LocalStack running
#   DOWN=1 bash scripts/e2e-local.sh     # stops LocalStack at the end
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 AWS_PAGER=""
EP=http://localhost:4566; API=http://localhost:3000; LAMBDA=http://localhost:3002
QUEUE_URL="$EP/000000000000/MailQueue-local"
RUN="e2e-$(date +%s)"; TMP=$(mktemp -d)
pass=0; fail=0; OFFLINE=
step() { printf '\n== %s\n' "$*"; }
ok()   { printf '  PASS %s\n' "$*"; pass=$((pass+1)); }
bad()  { printf '  FAIL %s\n' "$*"; fail=$((fail+1)); }
expect() { [ "$3" = "$2" ] && ok "$1 ($3)" || bad "$1: want $2, got $3"; }
json() { python3 -c "import json,sys; d=json.load(open('$1')); print($2)"; }
req()  { curl -s -o "$TMP/body" -w '%{http_code}' "$@"; }
cleanup() {
  [ -n "$OFFLINE" ] && { kill "$OFFLINE" 2>/dev/null; wait "$OFFLINE" 2>/dev/null; }; pkill -f 'serverless offline' 2>/dev/null
  [ "${DOWN:-0}" = 1 ] && docker compose down >/dev/null 2>&1
  rm -rf "$TMP"
}
trap cleanup EXIT
command -v aws >/dev/null || { echo "install the AWS CLI (brew install awscli)"; exit 1; }

step "0. Dependencies (shared/aws.js resolves the AWS SDK from the root package)"
for d in . auth-service auction-service notification-service; do
  [ -d "$d/node_modules" ] || (cd "$d" && npm ci --no-audit --no-fund >/dev/null 2>&1) || { echo "npm ci failed in $d"; exit 1; }
done
echo "  ok"

step "1. LocalStack"
docker compose up -d --remove-orphans localstack >/dev/null 2>&1
for i in $(seq 1 60); do curl -sf "$EP/_localstack/health" >/dev/null && break; sleep 2; done
curl -sf "$EP/_localstack/health" >/dev/null || { echo "LocalStack did not start"; exit 1; }
bash scripts/localstack-bootstrap.sh "$EP" us-east-1 | sed 's/^/  /'

step "2. auction-service on serverless-offline (:3000, lambda :3002)"
(cd auction-service && npm run start:local >"$TMP/offline.log" 2>&1) & OFFLINE=$!
for i in $(seq 1 60); do curl -s -o /dev/null "$API/auctions?status=OPEN" && break; sleep 1; done
curl -s -o /dev/null "$API/auctions?status=OPEN" || { tail -30 "$TMP/offline.log"; exit 1; }
echo "  up"

step "3. Validation and CRUD"
expect "empty title -> 400"        400 "$(req -X POST -H 'Content-Type: application/json' -d '{"title":"  "}' "$API/auction")"
expect "ending in the past -> 400" 400 "$(req -X POST -H 'Content-Type: application/json' -d '{"title":"x","endingAt":"2000-01-01T00:00:00Z"}' "$API/auction")"
expect "create -> 201"             201 "$(req -X POST -H 'Content-Type: application/json' -d "{\"title\":\"$RUN lamp\"}" "$API/auction")"
ID=$(json "$TMP/body" 'd["id"]')
expect "get -> 200"                200 "$(req "$API/auction/$ID")"
expect "list OPEN -> 200"          200 "$(req "$API/auctions?status=OPEN")"
expect "unknown id -> 404"         404 "$(req "$API/auction/00000000-0000-0000-0000-000000000000")"
expect "bid 50 -> 200"             200 "$(req -X PATCH -H 'Content-Type: application/json' -d '{"amount":50}' "$API/auction/$ID/bid")"
expect "bid 0 -> 400"              400 "$(req -X PATCH -H 'Content-Type: application/json' -d '{"amount":0}' "$API/auction/$ID/bid")"

step "4. Concurrent bids: 10 requests race for the same auction"
req -X POST -H 'Content-Type: application/json' -d "{\"title\":\"$RUN race\"}" "$API/auction" >/dev/null
RID=$(json "$TMP/body" 'd["id"]')
BIDS=()
for i in $(seq 1 10); do
  curl -s -o /dev/null -w '%{http_code}\n' -X PATCH -H 'Content-Type: application/json' -d '{"amount":100}' "$API/auction/$RID/bid" >>"$TMP/race" &
  BIDS+=($!)
done
wait "${BIDS[@]}"   # only the bids; a bare `wait` would also wait for the offline server and hang
WINS=$(grep -c '^200$' "$TMP/race"); echo "  status codes: $(sort "$TMP/race" | uniq -c | tr -s ' ' | tr '\n' ' ')"
expect "exactly one bid wins" 1 "$WINS"
req "$API/auction/$RID" >/dev/null; expect "highest bid stored" 100 "$(json "$TMP/body" 'd["highestBid"]["amount"]')"

step "5. Close an auction and queue the emails"
# LocalStack keeps state between runs (PERSISTENCE=1); start from an empty mail queue so old messages can't crowd out this run's.
aws sqs purge-queue --endpoint-url "$EP" --queue-url "$QUEUE_URL" >/dev/null 2>&1; sleep 1
END=$(python3 -c 'import datetime as d; print((d.datetime.now(d.timezone.utc)+d.timedelta(seconds=4)).strftime("%Y-%m-%dT%H:%M:%S.000Z"))')
req -X POST -H 'Content-Type: application/json' -d "{\"title\":\"$RUN clock\",\"endingAt\":\"$END\"}" "$API/auction" >/dev/null
CID=$(json "$TMP/body" 'd["id"]')
req -X PATCH -H 'Content-Type: application/json' -d '{"amount":75}' "$API/auction/$CID/bid" >/dev/null
sleep 6
aws lambda invoke --endpoint-url "$LAMBDA" --function-name auction-service-local-processAuctions \
  --cli-binary-format raw-in-base64-out --payload '{}' "$TMP/pa.json" >/dev/null 2>&1
echo "  processAuctions -> $(cat "$TMP/pa.json")"
req "$API/auction/$CID" >/dev/null; expect "auction CLOSED" CLOSED "$(json "$TMP/body" 'd["status"]')"
aws lambda invoke --endpoint-url "$LAMBDA" --function-name auction-service-local-processAuctions \
  --cli-binary-format raw-in-base64-out --payload '{}' "$TMP/pa2.json" >/dev/null 2>&1
expect "second run closes nothing twice" 0 "$(json "$TMP/pa2.json" 'd.get("closed",0)')"

: >"$TMP/msgs"
for i in 1 2 3 4 5; do
  # one compact JSON document per line (the CLI pretty-prints over many lines otherwise)
  aws sqs receive-message --endpoint-url "$EP" --queue-url "$QUEUE_URL" --max-number-of-messages 10 --wait-time-seconds 1 \
    --output json 2>/dev/null | python3 -c 'import json,sys; t=sys.stdin.read().strip(); print(json.dumps(json.loads(t)) if t else "{}")' >>"$TMP/msgs"
done
python3 - "$TMP/msgs" "$RUN clock" "$TMP/event.json" <<'PY'
import json,sys
docs=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
msgs=[m for d in docs for m in d.get("Messages",[])]
title=sys.argv[2]
recs=[{"messageId":m["MessageId"],"receiptHandle":m["ReceiptHandle"],"body":m["Body"],"eventSource":"aws:sqs"}
      for m in msgs if title in m["Body"]]
json.dump({"Records":recs},open(sys.argv[3],"w"))
print(f"  received {len(msgs)} message(s) from MailQueue-local, {len(recs)} for this run")
PY
N=$(json "$TMP/event.json" 'len(d["Records"])')
expect "2 emails queued (seller + winner)" 2 "$N"

step "6. notification-service sends them through SES"
if [ "$N" -gt 0 ]; then
  ( cd notification-service && SENDER_EMAIL=test@example.com npx serverless invoke local -f sendMail --stage local -p "$TMP/event.json" ) >"$TMP/send.out" 2>&1
  grep -q '"batchItemFailures": \[\]' "$TMP/send.out" && ok "sendMail: $N messages, no failures" || { bad "sendMail failed"; tail -15 "$TMP/send.out"; }
else
  bad "sendMail: nothing to send (no queued messages)"
fi
curl -s "$EP/_aws/ses" >"$TMP/ses.json"
SENT=$(python3 -c "import json; d=json.load(open('$TMP/ses.json')); print(sum(1 for m in d.get('messages',[]) if '$RUN clock' in json.dumps(m)))")
expect "SES received both emails" 2 "$SENT"

echo '{"Records":[{"messageId":"poison-1","body":"{\"subject\":\"no recipient\"}","eventSource":"aws:sqs"}]}' >"$TMP/poison.json"
( cd notification-service && SENDER_EMAIL=test@example.com npx serverless invoke local -f sendMail --stage local -p "$TMP/poison.json" ) >"$TMP/poison.out" 2>&1
grep -q 'poison-1' "$TMP/poison.out" && ok "poison message reported as a batch failure (goes to the DLQ after 3 tries)" || bad "poison message not reported"

printf '\npassed %s, failed %s\n' "$pass" "$fail"
[ "$fail" = 0 ]
