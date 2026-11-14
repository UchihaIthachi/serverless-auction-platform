#!/usr/bin/env bash
# Deploy all three services to real AWS, in dependency order, after safety checks.
# You run this yourself with your own AWS profile (SSO); no keys are read or printed here.
#
#   export AWS_PROFILE=auction  AUTH0_AUDIENCE=...  AUTH0_ISSUER=https://<tenant>.auth0.com/  SENDER_EMAIL=you@example.com
#   bash scripts/deploy-aws.sh            # stage dev, region us-east-1
#   STAGE=dev REGION=us-east-1 bash scripts/deploy-aws.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
STAGE="${STAGE:-dev}"; REGION="${REGION:-us-east-1}"
step() { printf '\n== %s\n' "$*"; }
die()  { printf '\n!! STOPPED: %s\n' "$*"; exit 1; }
ok()   { printf '  ok  %s\n' "$*"; }

step "1. Who am I (account and role only)"
ID=$(aws sts get-caller-identity --output json) || die "not signed in: aws sso login --profile \$AWS_PROFILE"
ACCOUNT=$(echo "$ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Account"])')
echo "$ID" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  account", d["Account"]); print("  as     ", d["Arn"].split(":",5)[-1])'
case "$(echo "$ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Arn"])')" in
  *:root) die "you are signed in as the root user; use an IAM Identity Center (SSO) user";;
esac

step "2. Cost guard: a budget must exist before anything is created"
N=$(aws budgets describe-budgets --account-id "$ACCOUNT" --query 'length(Budgets)' --output text 2>/dev/null || echo 0)
[ "${N:-0}" != "None" ] && [ "${N:-0}" -ge 1 ] || die "no AWS Budget found; create the \$5 budget first (README: Deploy to AWS)"
aws budgets describe-budgets --account-id "$ACCOUNT" --query 'Budgets[].[BudgetName,BudgetLimit.Amount,BudgetLimit.Unit]' --output text | sed 's/^/  budget /'

step "3. Inputs"
[ -f auth-service/secret.pem ] || die "auth-service/secret.pem missing (Auth0 signing certificate, git-ignored)"
grep -q 'BEGIN CERTIFICATE\|BEGIN PUBLIC KEY' auth-service/secret.pem || die "secret.pem is not a PEM certificate or public key"
ok "auth-service/secret.pem"
for v in AUTH0_AUDIENCE AUTH0_ISSUER SENDER_EMAIL; do [ -n "${!v:-}" ] || die "export $v first"; ok "$v=${!v}"; done
case "$AUTH0_ISSUER" in https://*/) ;; *) die "AUTH0_ISSUER must look like https://<tenant>.auth0.com/ (with the trailing slash)";; esac

step "4. SES: sender verified in $REGION (sandbox: recipients must be verified too)"
V=$(aws sesv2 get-email-identity --region "$REGION" --email-identity "$SENDER_EMAIL" --query VerifiedForSendingStatus --output text 2>/dev/null || echo missing)
[ "$V" = True ] || die "SES identity $SENDER_EMAIL is '$V'. Run: aws sesv2 create-email-identity --region $REGION --email-identity $SENDER_EMAIL  and click the link in the email"
ok "$SENDER_EMAIL verified"

step "5. Dependencies"
for s in auth-service notification-service auction-service; do
  [ -d "$s/node_modules" ] || (cd "$s" && npm ci --no-audit --no-fund >/dev/null) && ok "$s"
done

deploy() { step "6. Deploy $1 ($STAGE, $REGION)"; (cd "$1" && npx serverless deploy --stage "$STAGE" --region "$REGION"); }
deploy auth-service           # the authorizer Lambda the auction API points to
deploy notification-service   # the mail queue + DLQ the auction service reads from CloudFormation outputs
deploy auction-service

step "7. Endpoints"
for s in auth-service auction-service; do (cd "$s" && npx serverless info --stage "$STAGE" --region "$REGION" | sed -n '/endpoints:/,/functions:/p' | grep -v functions:); done
echo
echo "Next: get an access token (README: Auth0) and run  TOKEN=... bash scripts/smoke-aws.sh"
