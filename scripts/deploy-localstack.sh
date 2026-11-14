#!/usr/bin/env bash
# "First deploy", $0: the real CloudFormation stacks (the same serverless.yml as AWS)
# deployed into LocalStack 3.5, then a smoke test through the deployed API Gateway.
# Unlike e2e-local.sh (serverless-offline), here every event is wired by LocalStack:
# the EventBridge sweep rule, the OutboxTable stream -> relayOutbox, and SQS -> sendMail.
#
#   bash scripts/deploy-localstack.sh           # deploy + smoke test (about 3-4 minutes)
#   SKIP_DEPLOY=1 bash scripts/deploy-localstack.sh   # smoke test only
#   DOWN=1 bash scripts/deploy-localstack.sh    # stop LocalStack at the end
#
# Not in LocalStack community, so not deployed here: CloudFront (useCdn is off for this
# stage) and the Auth0 authorizer (auth-service). Schedules are created but LocalStack
# community doesn't fire them; the 1-minute sweep closes the auction instead.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 AWS_PAGER=""
STAGE=localstack; EP=http://localhost:4566; RUN="ls-$(date +%s)"; TMP=$(mktemp -d)
pass=0; fail=0
step() { printf '\n== %s\n' "$*"; }
ok()   { printf '  PASS %s\n' "$*"; pass=$((pass+1)); }
bad()  { printf '  FAIL %s\n' "$*"; fail=$((fail+1)); }
expect() { [ "$3" = "$2" ] && ok "$1 ($3)" || bad "$1: want $2, got $3"; }
json() { python3 -c "import json,sys; d=json.load(open('$1')); print($2)"; }
req()  { curl -s -o "$TMP/body" -w '%{http_code}' "$@"; }
die()  { printf '\n!! %s\n' "$*"; exit 1; }
trap '[ "${DOWN:-0}" = 1 ] && docker compose down >/dev/null 2>&1; rm -rf "$TMP"' EXIT
command -v aws >/dev/null || die "install the AWS CLI (brew install awscli)"
command -v docker >/dev/null || die "Docker Desktop must be running"

step "1. LocalStack 3.5 (Lambda functions run as Docker containers, so this needs the Docker socket)"
docker compose up -d --remove-orphans localstack >/dev/null 2>&1
for i in $(seq 1 60); do curl -sf "$EP/_localstack/health" >/dev/null && break; sleep 2; done
curl -sf "$EP/_localstack/health" >/dev/null || die "LocalStack did not start (docker logs localstack)"
aws ses verify-email-identity --endpoint-url "$EP" --email-address test@example.com >/dev/null
echo "  up; SES sender test@example.com verified"

if [ "${SKIP_DEPLOY:-0}" != 1 ]; then
  for d in . notification-service auction-service; do
    [ -d "$d/node_modules" ] || (cd "$d" && npm ci --no-audit --no-fund >/dev/null 2>&1) || die "npm ci failed in $d"
  done
  for s in notification-service auction-service; do   # the auction stack reads the queue/topic outputs of the first
    step "2. serverless deploy $s --stage $STAGE  ->  LocalStack CloudFormation"
    # serverless-esbuild leaves its esbuild service running when output isn't a terminal, so
    # `serverless deploy` never exits after a successful deploy. Watch the log instead, then
    # stop that service's leftover processes.
    LOG="$TMP/deploy-$s.log"; : >"$LOG"
    (cd "$s" && NODE_OPTIONS=--openssl-legacy-provider npx serverless deploy --stage "$STAGE" >"$LOG" 2>&1) & DPID=$!
    for i in $(seq 1 300); do   # up to 10 minutes (first run pulls the Lambda image)
      grep -qE 'Service deployed|Deployment skipped|^Error:|✖' "$LOG" && break
      kill -0 "$DPID" 2>/dev/null || break
      sleep 2
    done
    sleep 2
    pkill -f "$PWD/$s/node_modules" 2>/dev/null; kill "$DPID" 2>/dev/null; wait "$DPID" 2>/dev/null
    grep -E 'Deploying|Service deployed|Deployment skipped|stage-throttling|Error|error' "$LOG" | sed 's/^/  /'
    grep -qE 'Service deployed|Deployment skipped' "$LOG" || { tail -30 "$LOG"; die "deploy of $s failed"; }
  done
fi

step "3. What CloudFormation created"
for st in notification-service-$STAGE auction-service-$STAGE; do
  S=$(aws cloudformation describe-stacks --endpoint-url "$EP" --stack-name "$st" --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
  expect "stack $st" CREATE_COMPLETE "$( [ "$S" = UPDATE_COMPLETE ] && echo CREATE_COMPLETE || echo "$S")"
done
API_ID=$(aws apigateway get-rest-apis --endpoint-url "$EP" --query "items[?name=='$STAGE-auction-service'].id | [0]" --output text)
[ -n "$API_ID" ] && [ "$API_ID" != None ] || die "auction REST API not found"
API="$EP/restapis/$API_ID/$STAGE/_user_request_"
echo "  API $API"
aws apigateway get-stage --endpoint-url "$EP" --rest-api-id "$API_ID" --stage-name "$STAGE" --output json >"$TMP/stage.json"
expect "stage throttling (all methods)"   20 "$(json "$TMP/stage.json" 'int(d.get("methodSettings",{}).get("*/*",{}).get("throttlingRateLimit",0))')"
expect "bid throttling (PATCH .../bid)"   10 "$(json "$TMP/stage.json" 'int(d.get("methodSettings",{}).get("~1auction~1{id}~1bid/PATCH",{}).get("throttlingRateLimit",0))')"
# Counted from CloudFormation: recent AWS CLI versions send CloudWatch calls in a newer wire
# format that LocalStack 3.5 can't parse ("Missing Action"), so describe-alarms fails there.
ALARMS=0
for st in notification-service-$STAGE auction-service-$STAGE; do
  n=$(aws cloudformation list-stack-resources --endpoint-url "$EP" --stack-name "$st" \
      --query "length(StackResourceSummaries[?ResourceType=='AWS::CloudWatch::Alarm' && ResourceStatus=='CREATE_COMPLETE'])" --output text 2>/dev/null)
  ALARMS=$((ALARMS + ${n:-0}))
done
expect "CloudWatch alarms (DLQ, queue age, relay failures, relay lag)" 4 "$ALARMS"
expect "outbox stream -> relayOutbox mapping" Enabled "$(aws lambda list-event-source-mappings --endpoint-url "$EP" --function-name "auction-service-$STAGE-relayOutbox" --query 'EventSourceMappings[0].State' --output text 2>/dev/null)"

step "4. Through the deployed API Gateway + Lambda"
END=$(python3 -c 'import datetime as d; print((d.datetime.now(d.timezone.utc)+d.timedelta(seconds=60)).strftime("%Y-%m-%dT%H:%M:%S.000Z"))')
# Right after a deploy, LocalStack's API Gateway can answer the first few requests before the
# new stage settles (seen: two 422s, then 201s for the same body). Retry for up to 30 s.
for try in $(seq 1 10); do
  CODE=$(req -X POST -H 'Content-Type: application/json' -d "{\"title\":\"$RUN chair\",\"endingAt\":\"$END\"}" "$API/auction")
  [ "$CODE" = 201 ] && break; sleep 3
done
[ "$try" -gt 1 ] && echo "  (create needed $try tries while the new stage settled)"
expect "create -> 201" 201 "$CODE"
ID=$(json "$TMP/body" 'd.get("id","")')
expect "get -> 200"        200 "$(req "$API/auction/$ID")"
expect "bid 30 -> 200"     200 "$(req -X PATCH -H 'Content-Type: application/json' -d '{"amount":30}' "$API/auction/$ID/bid")"
expect "lower bid -> 403"  403 "$(req -X PATCH -H 'Content-Type: application/json' -d '{"amount":10}' "$API/auction/$ID/bid")"
if aws scheduler get-schedule --endpoint-url "$EP" --name "auction-$ID" --output json >"$TMP/sched.json" 2>/dev/null; then
  expect "per-auction schedule created" "auction-$ID" "$(json "$TMP/sched.json" 'd.get("Name")')"
else
  echo "  (no EventBridge Scheduler in this LocalStack; the sweep still closes it)"
fi

step "5. Close -> outbox -> stream -> relayOutbox -> SQS -> sendMail -> SES, all wired by LocalStack (up to 3 min)"
for i in $(seq 1 36); do
  req "$API/auction/$ID" >/dev/null
  [ "$(json "$TMP/body" 'd.get("status")')" = CLOSED ] && break; sleep 5
done
expect "auction closed by the sweep rule" CLOSED "$(json "$TMP/body" 'd.get("status")')"
SENT=0
for i in $(seq 1 24); do
  curl -sf "$EP/_aws/ses" >"$TMP/ses.json" 2>/dev/null && \
    SENT=$(python3 -c "import json; d=json.load(open('$TMP/ses.json')); print(sum(1 for m in d.get('messages',[]) if '$RUN chair' in json.dumps(m)))")
  [ "$SENT" -ge 2 ] && break; sleep 5
done
expect "SES got both emails (seller + winner)" 2 "$SENT"

printf '\npassed %s, failed %s\n' "$pass" "$fail"
[ "$fail" = 0 ] || echo "Logs: docker logs localstack 2>&1 | tail -100   and   aws logs tail /aws/lambda/auction-service-$STAGE-relayOutbox --endpoint-url $EP"
[ "$fail" = 0 ]
